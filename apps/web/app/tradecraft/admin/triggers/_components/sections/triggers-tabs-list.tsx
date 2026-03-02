import { DollarSign, PlayCircle, Database, Wrench } from "lucide-react";
import { TabsList, TabsTrigger } from "@eve/ui";

export function TriggersTabsList() {
  return (
    <TabsList className="grid w-full max-w-2xl grid-cols-4">
      <TabsTrigger value="imports" className="gap-2">
        <Database className="h-4 w-4" />
        Data Imports
      </TabsTrigger>
      <TabsTrigger value="participations" className="gap-2">
        <PlayCircle className="h-4 w-4" />
        Participations
      </TabsTrigger>
      <TabsTrigger value="financial" className="gap-2">
        <DollarSign className="h-4 w-4" />
        Financial
      </TabsTrigger>
      <TabsTrigger value="system-cleanup" className="gap-2">
        <Wrench className="h-4 w-4" />
        System Cleanup
      </TabsTrigger>
    </TabsList>
  );
}
