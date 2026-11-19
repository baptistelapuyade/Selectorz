import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const missingConfiguration = !token
  ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
  : !host
    ? "NEXT_PUBLIC_POSTHOG_HOST"
    : undefined;

const processors = token && host
  ? [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({
          url: `${host.replace(/\/$/, "")}/i/v1/logs`,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      }),
    ]
  : [];

const posthogLoggerProvider = new LoggerProvider({
  resource: resourceFromAttributes({ "service.name": "selectorz-web" }),
  processors,
});

export const posthogLogger = posthogLoggerProvider.getLogger("selectorz.posthog");

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && missingConfiguration && process.env.NODE_ENV !== "production") {
    console.warn(`${missingConfiguration} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingConfiguration} is configured`);
  }
}
