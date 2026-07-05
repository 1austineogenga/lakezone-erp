package ke.lakezone.erp;

import android.Manifest;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private ActivityResultLauncher<String> notifPermLauncher;
    private boolean permissionRequested = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FcmPlugin.class);
        super.onCreate(savedInstanceState);

        getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        getWindow().setStatusBarColor(Color.parseColor("#1a2332"));

        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setAppearanceLightStatusBars(false);

        notifPermLauncher = registerForActivityResult(
            new ActivityResultContracts.RequestPermission(), granted -> {});
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Request notification permission 5s after app is visible — well after WebView loads
        if (!permissionRequested && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionRequested = true;
            new Handler(Looper.getMainLooper()).postDelayed(
                () -> notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS),
                5000
            );
        }
    }
}
