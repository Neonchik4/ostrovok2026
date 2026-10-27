import { Database } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@/shared/ui";

/** Техническая ссылка на Studio; временная, удаляется вместе с вызовом в AppHeader. */
export function StudioLink() {
  return (
    <Link href="/studio">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Database className="mr-1.5 h-3.5 w-3.5 text-primary" /> Studio
      </Button>
    </Link>
  );
}
