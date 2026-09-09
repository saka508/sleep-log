export async function configureDailyReminder(enabled: boolean, _time: string): Promise<string> {
  return enabled ? "web" : "off";
}
