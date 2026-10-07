import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "@/components/CopyButton";
import { COMMANDS } from "@/config/site";

export default function CommandTabs() {
  return (
    <Tabs defaultValue={COMMANDS[0].id} className="command-tabs">
      <TabsList variant="line" aria-label="Report commands" className="command-tab-list">
        {COMMANDS.map(({ id, label }) => (
          <TabsTrigger value={id} key={id}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {COMMANDS.map(({ id, command, description }) => (
        <TabsContent value={id} key={id} className="command-panel">
          <div className="command-line">
            <span aria-hidden="true">$</span>
            <code>{command}</code>
            <CopyButton text={command} />
          </div>
          <p>{description}</p>
        </TabsContent>
      ))}
    </Tabs>
  );
}
