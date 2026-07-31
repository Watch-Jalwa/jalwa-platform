import { emitObservabilityEvent } from "@/lib/observability/event";

let registered = false;

export function registerNodeProcessHandlers() {
  if (registered) return;
  registered = true;

  process.on("uncaughtException", (error) => {
    emitObservabilityEvent({ level: "fatal", event: "web.uncaught_exception", error });
  });

  process.on("unhandledRejection", (reason) => {
    emitObservabilityEvent({ level: "fatal", event: "web.unhandled_rejection", error: reason });
  });
}
