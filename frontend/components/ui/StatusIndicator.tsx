import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusConfig = {
  Online: {
    color: "bg-green-500",
    label: "En ligne",
  },
  Away: {
    color: "bg-yellow-500",
    label: "Absent",
  },
  Busy: {
    color: "bg-red-500",
    label: "Occupé",
  },
  Offline: {
    color: "bg-gray-400",
    label: "Hors ligne",
  },
};

interface StatusIndicatorProps {
  status: keyof typeof statusConfig;
  size?: "sm" | "md";
  showTooltip?: boolean;
}

export function StatusIndicator({ status, size = "sm", showTooltip = true }: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeClass = size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";

  const indicator = (
    <span
      className={`inline-block rounded-full ${config.color} ${sizeClass} ring-2 ring-background`}
      aria-label={config.label}
    />
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
