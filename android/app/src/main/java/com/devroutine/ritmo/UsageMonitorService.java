package com.devroutine.ritmo;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

public class UsageMonitorService extends Service {
    public static final String PREFS = "ritmo_phone_usage";
    public static final String PREF_ACTIVE = "monitor_active";
    public static final String EXTRA_BREAK_MINUTES = "break_minutes";
    public static final String ACTION_STOP = "com.devroutine.ritmo.STOP_USAGE_MONITOR";
    private static final String ACTION_BREAK_DONE = "com.devroutine.ritmo.BREAK_DONE";
    private static final String ACTION_SNOOZE = "com.devroutine.ritmo.SNOOZE_BREAK";
    private static final String CHANNEL_STATUS = "usage_monitor_status";
    private static final String CHANNEL_BREAKS = "usage_break_reminders";
    private static final int NOTIFICATION_STATUS = 5101;
    private static final int NOTIFICATION_BREAK = 5102;
    private static final long CHECK_INTERVAL_MS = 20_000L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private UsageStatsManager usageStatsManager;
    private SharedPreferences preferences;
    private int breakMinutes = 30;
    private String foregroundPackage;
    private long lastQueryTime;
    private long lastCountedTime;
    private long useMillis;
    private long snoozeUntil;
    private boolean screenInteractive = true;
    private boolean reminderVisible;

    private final Runnable poll = new Runnable() {
        @Override public void run() {
            pollUsage();
            handler.postDelayed(this, CHECK_INTERVAL_MS);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        usageStatsManager = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
        createNotificationChannels();
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopMonitor();
            return START_NOT_STICKY;
        }
        if (ACTION_BREAK_DONE.equals(action)) {
            useMillis = 0;
            snoozeUntil = 0;
            reminderVisible = false;
            cancelBreakReminder();
        } else if (ACTION_SNOOZE.equals(action)) {
            snoozeUntil = System.currentTimeMillis() + 10 * 60_000L;
            reminderVisible = false;
            cancelBreakReminder();
        }
        if (intent != null && intent.hasExtra(EXTRA_BREAK_MINUTES)) {
            breakMinutes = Math.max(10, Math.min(intent.getIntExtra(EXTRA_BREAK_MINUTES, 30), 120));
        } else {
            breakMinutes = preferences.getInt(EXTRA_BREAK_MINUTES, 30);
        }
        preferences.edit().putBoolean(PREF_ACTIVE, true).putInt(EXTRA_BREAK_MINUTES, breakMinutes).apply();
        startAsForeground();
        if (lastQueryTime == 0) initializeUsageState();
        handler.removeCallbacks(poll);
        handler.postDelayed(poll, CHECK_INTERVAL_MS);
        return START_STICKY;
    }

    private void startAsForeground() {
        Notification status = buildStatusNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_STATUS, status, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_STATUS, status);
        }
    }

    private void initializeUsageState() {
        long now = System.currentTimeMillis();
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        screenInteractive = power == null || power.isInteractive();
        lastQueryTime = now - 60_000L;
        lastCountedTime = lastQueryTime;
        processEvents(lastQueryTime, now);
        lastQueryTime = now;
        lastCountedTime = now;
    }

    private void pollUsage() {
        if (usageStatsManager == null) return;
        long now = System.currentTimeMillis();
        processEvents(lastQueryTime, now);
        if (screenInteractive && foregroundPackage != null && !getPackageName().equals(foregroundPackage)) {
            useMillis += Math.max(0, now - lastCountedTime);
        }
        lastQueryTime = now;
        lastCountedTime = now;
        if (!reminderVisible && now >= snoozeUntil && useMillis >= breakMinutes * 60_000L) {
            showBreakReminder();
            reminderVisible = true;
        }
    }

    private void processEvents(long begin, long end) {
        if (usageStatsManager == null) return;
        UsageEvents events;
        try { events = usageStatsManager.queryEvents(begin, end); }
        catch (SecurityException error) { stopMonitor(); return; }
        if (events == null) return;
        UsageEvents.Event event = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(event);
            int type = event.getEventType();
            long timestamp = event.getTimeStamp();
            if (type == UsageEvents.Event.SCREEN_NON_INTERACTIVE) {
                countSegment(timestamp);
                screenInteractive = false;
                foregroundPackage = null;
                lastCountedTime = timestamp;
            } else if (type == UsageEvents.Event.SCREEN_INTERACTIVE) {
                screenInteractive = true;
                foregroundPackage = null;
                lastCountedTime = timestamp;
            } else if (isForegroundEvent(type)) {
                countSegment(timestamp);
                foregroundPackage = event.getPackageName();
                lastCountedTime = timestamp;
            } else if (isBackgroundEvent(type) && event.getPackageName() != null && event.getPackageName().equals(foregroundPackage)) {
                countSegment(timestamp);
                foregroundPackage = null;
                lastCountedTime = timestamp;
            }
        }
    }

    private boolean isForegroundEvent(int type) {
        return type == UsageEvents.Event.ACTIVITY_RESUMED || type == UsageEvents.Event.MOVE_TO_FOREGROUND;
    }

    private boolean isBackgroundEvent(int type) {
        return type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.MOVE_TO_BACKGROUND;
    }

    private void countSegment(long end) {
        if (screenInteractive && foregroundPackage != null && !getPackageName().equals(foregroundPackage)) {
            useMillis += Math.max(0, end - lastCountedTime);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        manager.createNotificationChannel(new NotificationChannel(CHANNEL_STATUS, "Acompanhamento de pausas", NotificationManager.IMPORTANCE_LOW));
        manager.createNotificationChannel(new NotificationChannel(CHANNEL_BREAKS, "Lembretes de pausa", NotificationManager.IMPORTANCE_DEFAULT));
    }

    private Notification buildStatusNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(this, 1, openIntent, pendingFlags());
        PendingIntent stopPending = PendingIntent.getService(this, 2, new Intent(this, UsageMonitorService.class).setAction(ACTION_STOP), pendingFlags());
        return notificationBuilder(CHANNEL_STATUS)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Ritmo: lembretes de pausa ativos")
            .setContentText("Acompanhamento ligado. Toque para abrir ou encerrar.")
            .setContentIntent(openPending)
            .setOngoing(true)
            .addAction(new Notification.Action.Builder(null, "Encerrar", stopPending).build())
            .build();
    }

    private Notification.Builder notificationBuilder(String channel) {
        if (Build.VERSION.SDK_INT >= 26) return new Notification.Builder(this, channel);
        return new Notification.Builder(this);
    }

    private void showBreakReminder() {
        PendingIntent done = PendingIntent.getService(this, 3, new Intent(this, UsageMonitorService.class).setAction(ACTION_BREAK_DONE), pendingFlags());
        PendingIntent snooze = PendingIntent.getService(this, 4, new Intent(this, UsageMonitorService.class).setAction(ACTION_SNOOZE), pendingFlags());
        Notification notification = notificationBuilder(CHANNEL_BREAKS)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("Já deu " + breakMinutes + " minutos de uso")
            .setContentText("Quer fazer uma pausa agora?")
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER)
            .addAction(new Notification.Action.Builder(null, "Fiz uma pausa", done).build())
            .addAction(new Notification.Action.Builder(null, "Lembrar em 10 min", snooze).build())
            .build();
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(NOTIFICATION_BREAK, notification);
    }

    private void cancelBreakReminder() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.cancel(NOTIFICATION_BREAK);
    }

    private int pendingFlags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    private void stopMonitor() {
        handler.removeCallbacks(poll);
        preferences.edit().putBoolean(PREF_ACTIVE, false).apply();
        cancelBreakReminder();
        stopForeground(true);
        stopSelf();
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(poll);
        super.onDestroy();
    }

    @Override public IBinder onBind(Intent intent) { return null; }
}
