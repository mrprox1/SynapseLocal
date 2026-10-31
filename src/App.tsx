import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/store/workspace";

export default function App() {
  const { root, files, openFolder, restoreLast } = useWorkspace();
  useEffect(() => {
    restoreLast().catch(console.warn);
  }, [restoreLast]);

  return (
    <main className="flex h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold text-primary">SynapseLocal</h1>
      <Button onClick={() => openFolder().catch(console.error)}>Open folder</Button>
      {root && (
        <p className="text-sm text-muted-foreground">
          {root}: {Object.keys(files).length} files
        </p>
      )}
    </main>
  );
}
