"use client";

import {
  Globe,
  FileText,
  BarChart3,
  AlignLeft,
  Braces,
  Mail,
  Rocket,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const iconMap: Record<string, typeof Globe> = {
  Globe,
  FileText,
  BarChart3,
  AlignLeft,
  Braces,
  Mail,
};

type TemplateCardProps = {
  name: string;
  description: string;
  category: string;
  icon: string;
  deploying?: boolean;
  onDeploy: () => void;
};

export function TemplateCard({
  name,
  description,
  category,
  icon,
  deploying,
  onDeploy,
}: TemplateCardProps) {
  const Icon = iconMap[icon] ?? Rocket;

  return (
    <Card
      size="sm"
      className="flex flex-col transition-all hover:ring-foreground/20 hover:shadow-sm"
    >
      <CardHeader className="flex-row items-center gap-2">
        <span
          className={cn(
            "flex items-center justify-center size-7 rounded-md bg-primary/10 text-primary"
          )}
        >
          <Icon size={14} />
        </span>
        <Badge variant="outline" className="text-muted-foreground">
          {category}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-1 flex-1">
        <h3 className="font-semibold text-foreground text-sm leading-tight">
          {name}
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {description}
        </p>
      </CardContent>

      <CardFooter>
        <Button
          size="sm"
          variant="default"
          className="w-full gap-1.5"
          disabled={deploying}
          onClick={(e) => {
            e.stopPropagation();
            onDeploy();
          }}
        >
          {deploying ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Deploying...
            </>
          ) : (
            <>
              <Rocket size={12} />
              Deploy
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
