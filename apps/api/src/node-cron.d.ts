declare module "node-cron" {
  interface ScheduledTask {
    start(): void;
    stop(): void;
  }

  function schedule(
    cronExpression: string,
    task: () => void | Promise<void>,
    options?: { scheduled?: boolean; timezone?: string }
  ): ScheduledTask;
}
