import { type NoteDetail } from "@cashsouk/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getNoteCommercialTermRows } from "@/notes/utils/note-commercial-terms";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export function NoteTermsPanel({ note }: { note: NoteDetail }) {
  const rows = getNoteCommercialTermRows(note);

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="text-base">Commercial Terms</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 text-ui md:grid-cols-2">
          {rows.map((row) => (
            <Row key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
