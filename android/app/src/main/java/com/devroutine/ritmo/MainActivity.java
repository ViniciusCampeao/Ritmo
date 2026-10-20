package com.devroutine.ritmo;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PhoneUsagePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
