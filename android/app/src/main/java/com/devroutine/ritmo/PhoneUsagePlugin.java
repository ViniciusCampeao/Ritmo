package com.devroutine.ritmo;

import android.app.AppOpsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "PhoneUsage",
    permissions = {
        @Permission(alias = "notifications", strings = { android.Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class PhoneUsagePlugin extends Plugin {
    @PluginMethod
    public void permission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Unable to open Android usage access settings", error);
        }
    }

    @PluginMethod
    public void startMonitoring(PluginCall call) {
        if (!hasUsageAccess()) {
            call.reject("usage_permission_required");
            return;
        }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "startAfterNotifications");
            return;
        }
        startService(call);
    }

    @PermissionCallback
    private void startAfterNotifications(PluginCall call) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("notification_permission_required");
            return;
        }
        startService(call);
    }

    private void startService(PluginCall call) {
        int minutes = call.getInt("breakMinutes", 30);
        minutes = Math.max(10, Math.min(minutes, 120));
        Intent intent = new Intent(getContext(), UsageMonitorService.class);
        intent.putExtra(UsageMonitorService.EXTRA_BREAK_MINUTES, minutes);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
            JSObject result = new JSObject();
            result.put("active", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Unable to start usage monitoring", error);
        }
    }

    @PluginMethod
    public void stopMonitoring(PluginCall call) {
        Intent intent = new Intent(getContext(), UsageMonitorService.class);
        intent.setAction(UsageMonitorService.ACTION_STOP);
        getContext().startService(intent);
        JSObject result = new JSObject();
        result.put("active", false);
        call.resolve(result);
    }

    @PluginMethod
    public void monitorState(PluginCall call) {
        boolean active = getContext().getSharedPreferences(UsageMonitorService.PREFS, Context.MODE_PRIVATE)
            .getBoolean(UsageMonitorService.PREF_ACTIVE, false);
        JSObject result = new JSObject();
        result.put("active", active);
        call.resolve(result);
    }

    private boolean hasUsageAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        } else {
            mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }
}
