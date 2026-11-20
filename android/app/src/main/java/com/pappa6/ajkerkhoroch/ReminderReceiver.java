package com.pappa6.ajkerkhoroch;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** Shows the "purpose still to be told" reminder. It carries no amounts or names beyond what the app put in it. */
public class ReminderReceiver extends BroadcastReceiver {
    static final String CHANNEL = "remind";

    @Override
    public void onReceive(Context ctx, Intent intent) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "খরচের খাত মনে করানো", NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(ch);
        }
        Intent open = new Intent(ctx, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pi = PendingIntent.getActivity(ctx, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(ctx, CHANNEL) : new Notification.Builder(ctx);
        b.setSmallIcon(R.drawable.ic_stat)
         .setContentTitle(title == null ? "আজকের খরচ" : title)
         .setContentText(body == null ? "কয়েকটা খরচের খাত বলা বাকি" : body)
         .setContentIntent(pi)
         .setAutoCancel(true);
        try { nm.notify(1, b.build()); } catch (SecurityException ignored) { }
    }
}
