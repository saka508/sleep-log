import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/use-colors";

type DialogTone = "danger" | "success" | "info";

export function ActionDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  cancelLabel,
  onCancel,
  tone = "info",
  busy = false,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  cancelLabel?: string;
  onCancel?: () => void;
  tone?: DialogTone;
  busy?: boolean;
}) {
  const colors = useColors();
  const accent = tone === "danger" ? colors.error : tone === "success" ? colors.success : colors.primary;
  const icon = tone === "danger" ? "delete-forever" : tone === "success" ? "check-circle" : "info";
  const canCancel = Boolean(onCancel) && !busy;

  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={canCancel ? onCancel : () => undefined}>
      <View style={[styles.backdrop, { backgroundColor: colors.foreground + "A8" }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel ?? "閉じる"} disabled={!canCancel} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: accent + "18" }]}>
            {busy ? <ActivityIndicator color={accent} /> : <MaterialIcons name={icon} size={30} color={accent} />}
          </View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={busy ? "削除中" : confirmLabel} disabled={busy} onPress={onConfirm} style={({ pressed }) => [styles.confirmButton, { backgroundColor: accent, opacity: busy ? 0.65 : pressed ? 0.84 : 1 }]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
              <Text style={styles.confirmText}>{busy ? "削除中…" : confirmLabel}</Text>
            </Pressable>
            {onCancel ? <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel ?? "キャンセル"} disabled={busy} onPress={onCancel} style={({ pressed }) => [styles.cancelButton, { borderColor: colors.border, opacity: busy ? 0.45 : pressed ? 0.72 : 1 }]}>
              <Text style={[styles.cancelText, { color: colors.foreground }]}>{cancelLabel ?? "キャンセル"}</Text>
            </Pressable> : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  dialog: { width: "100%", maxWidth: 400, borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 22, alignItems: "center", gap: 10, elevation: 12, shadowColor: "#000000", shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  iconWrap: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "900", textAlign: "center" },
  message: { fontSize: 14, lineHeight: 21, textAlign: "center" },
  actions: { width: "100%", gap: 10, marginTop: 10 },
  confirmButton: { minHeight: 52, borderRadius: 15, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16 },
  confirmText: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "900" },
  cancelButton: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 15, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  cancelText: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
});
