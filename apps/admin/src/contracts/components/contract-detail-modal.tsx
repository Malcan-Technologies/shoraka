import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { formatCurrency } from "@cashsouk/config";
import { ApplicationStatusBadge } from "@/components/application-review";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useContractDetail } from "@/contracts/hooks/use-contract-detail";
import { useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";
import {
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  IdentificationIcon,
  RectangleStackIcon,
  ShieldCheckIcon,
  UserIcon,
  DocumentTextIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/outline";

interface ContractDetailModalProps {
  contractId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FileDoc {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
}

const REVIEW_EMPTY_LABEL = "Not provided";

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function formatValue(key: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key.includes("value") || key.includes("facility") || key.includes("amount") || key.includes("financing")) {
      return formatCurrency(value);
    }
    return value.toLocaleString();
  }
  const lowerKey = key.toLowerCase();
  if ((lowerKey.includes("date") || lowerKey.endsWith("_at") || lowerKey === "updated") && isIsoDate(value)) {
    return format(new Date(value), "dd MMM yyyy");
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function renderFileLabel(doc?: FileDoc) {
  if (!doc?.file_name) return REVIEW_EMPTY_LABEL;
  if (!doc.file_size) return doc.file_name;
  return `${doc.file_name} (${(doc.file_size / 1024 / 1024).toFixed(2)} MB)`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium break-words mt-0.5">{value}</p>
    </div>
  );
}

function DynamicRows({
  data,
  exclude = [],
}: {
  data: Record<string, unknown> | null;
  exclude?: string[];
}) {
  if (!data) return null;
  const rows = Object.entries(data).filter(([key]) => !exclude.includes(key));
  if (rows.length === 0) return null;

  return (
    <div>
      {rows.map(([key, value]) => (
        <DetailRow
          key={key}
          label={key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())}
          value={formatValue(key, value)}
        />
      ))}
    </div>
  );
}

function hasOfferData(offer: Record<string, unknown> | null): boolean {
  if (!offer) return false;
  return Object.values(offer).some((value) => value !== null && value !== undefined && value !== "");
}

function TopMetaItem({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex h-5 w-5 items-center justify-center text-muted-foreground shrink-0 mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium break-words">{value}</div>
      </div>
    </div>
  );
}

export function ContractDetailModal({ contractId, open, onOpenChange }: ContractDetailModalProps) {
  const { data, isLoading, error } = useContractDetail(open ? (contractId ?? undefined) : undefined);
  const { getAccessToken } = useAuthToken();
  const [isOpeningDocument, setIsOpeningDocument] = React.useState(false);
  const contractDetails = (data?.contractDetails ?? null) as Record<string, unknown> | null;
  const customerDetails = (data?.customerDetails ?? null) as Record<string, unknown> | null;

  const openDocument = React.useCallback(
    async (s3Key: string) => {
      try {
        setIsOpeningDocument(true);
        const token = await getAccessToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
        const response = await fetch(`${apiUrl}/v1/s3/view-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ s3Key }),
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error?.message || "Failed to open document");
        }

        const viewUrl = result.data?.viewUrl as string | undefined;
        if (!viewUrl) {
          throw new Error("No view URL was returned");
        }
        window.open(viewUrl, "_blank", "noopener,noreferrer");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to open document");
      } finally {
        setIsOpeningDocument(false);
      }
    },
    [getAccessToken]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[95vw] p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>Contract Details</DialogTitle>
          <DialogDescription>
            Full contract information, including linked applications
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[80vh]">
          <div className="p-6 space-y-6">
            {isLoading && (
              <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
                Loading contract details...
              </div>
            )}

            {error && (
              <div className="rounded-2xl border bg-card p-6 text-sm text-destructive">
                {error instanceof Error ? error.message : "Failed to load contract details"}
              </div>
            )}

            {data && (
              <>
                <Card className="rounded-2xl shadow-sm">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                          <DocumentTextIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">
                            {data.title || data.contractNumber || data.id.slice(-8).toUpperCase()}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                            <ApplicationStatusBadge status={data.status} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                      <TopMetaItem
                        label="Created"
                        value={format(new Date(data.createdAt), "PPpp")}
                        icon={ClockIcon}
                      />
                      <TopMetaItem
                        label="Updated"
                        value={format(new Date(data.updatedAt), "PPpp")}
                        icon={ClockIcon}
                      />
                      <TopMetaItem
                        label="Offer Sent At"
                        value={
                          data.offerDetails?.sent_at
                            ? format(new Date(String(data.offerDetails.sent_at)), "PPpp")
                            : "Not sent"
                        }
                        icon={PaperAirplaneIcon}
                      />
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground font-mono">ID: {data.id}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <IdentificationIcon className="h-4 w-4" />
                      Contract Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <DetailRow
                          label="Contract Title"
                          value={formatValue("title", data.title ?? contractDetails?.title)}
                        />
                        <DetailRow label="Contract Description" value={formatValue("description", contractDetails?.description)} />
                        <DetailRow label="Contract Number" value={formatValue("number", contractDetails?.number)} />
                        <DetailRow label="Contract Start Date" value={formatValue("start_date", contractDetails?.start_date)} />
                        <DetailRow label="Contract End Date" value={formatValue("end_date", contractDetails?.end_date)} />
                      </div>
                      <div>
                        <DetailRow label="Contract Value" value={formatValue("value", contractDetails?.value)} />
                        <DetailRow label="Contract Financing" value={formatValue("financing", contractDetails?.financing)} />
                        <DetailRow label="Approved Facility" value={formatValue("approved_facility", contractDetails?.approved_facility)} />
                        <DetailRow label="Utilized Facility" value={formatValue("utilized_facility", contractDetails?.utilized_facility)} />
                        <DetailRow label="Available Facility" value={formatValue("available_facility", contractDetails?.available_facility)} />
                        <DynamicRows
                          data={contractDetails}
                          exclude={[
                            "title",
                            "description",
                            "number",
                            "value",
                            "financing",
                            "start_date",
                            "end_date",
                            "approved_facility",
                            "utilized_facility",
                            "available_facility",
                            "document",
                          ]}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="rounded-2xl shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        Customer Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DetailRow label="Customer Name" value={formatValue("name", customerDetails?.name)} />
                      <DetailRow label="Entity Type" value={formatValue("entity_type", customerDetails?.entity_type)} />
                      <DetailRow label="SSM Number" value={formatValue("ssm_number", customerDetails?.ssm_number)} />
                      <DetailRow label="Country" value={formatValue("country", customerDetails?.country)} />
                      <DetailRow
                        label="Related Party"
                        value={
                          customerDetails?.is_related_party === true
                            ? "Yes"
                            : customerDetails?.is_related_party === false
                              ? "No"
                              : REVIEW_EMPTY_LABEL
                        }
                      />
                      <DynamicRows
                        data={customerDetails}
                        exclude={["name", "entity_type", "ssm_number", "country", "is_related_party", "document"]}
                      />
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <ShieldCheckIcon className="h-4 w-4" />
                        Evidence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        const contractDoc = (contractDetails?.document ?? undefined) as FileDoc | undefined;
                        const customerDoc = (customerDetails?.document ?? undefined) as FileDoc | undefined;
                        return (
                          <>
                            <div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">Contract Document</p>
                                <p className="text-xs text-muted-foreground truncate">{renderFileLabel(contractDoc)}</p>
                              </div>
                              {contractDoc?.s3_key && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => openDocument(contractDoc.s3_key as string)}
                                  disabled={isOpeningDocument}
                                >
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                  View
                                </Button>
                              )}
                            </div>
                            <div className="flex items-center justify-between rounded-xl border bg-background px-4 py-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium">Customer Consent</p>
                                <p className="text-xs text-muted-foreground truncate">{renderFileLabel(customerDoc)}</p>
                              </div>
                              {customerDoc?.s3_key && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1"
                                  onClick={() => openDocument(customerDoc.s3_key as string)}
                                  disabled={isOpeningDocument}
                                >
                                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                                  View
                                </Button>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4" />
                      Offer
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!hasOfferData(data.offerDetails) ? (
                      <p className="text-sm text-muted-foreground">No offer has been made yet.</p>
                    ) : (
                      <>
                        <div className="grid gap-6 lg:grid-cols-2">
                          <div>
                            <DetailRow label="Sent At" value={formatValue("sent_at", data.offerDetails?.sent_at)} />
                            <DetailRow label="Expires At" value={formatValue("expires_at", data.offerDetails?.expires_at)} />
                            <DetailRow
                              label="Responded At"
                              value={
                                data.offerDetails?.responded_at
                                  ? formatValue("responded_at", data.offerDetails.responded_at)
                                  : "No response yet"
                              }
                            />
                            <DetailRow
                              label="Responded By"
                              value={data.offerRespondedByUserName ?? "No response yet"}
                            />
                          </div>
                          <div>
                            <DetailRow label="Requested Facility" value={formatValue("requested_facility", data.offerDetails?.requested_facility)} />
                            <DetailRow label="Offered Facility" value={formatValue("offered_facility", data.offerDetails?.offered_facility)} />
                            <DetailRow label="Sent By" value={data.offerSentByUserName ?? REVIEW_EMPTY_LABEL} />
                          </div>
                        </div>
                        <DynamicRows
                          data={data.offerDetails}
                          exclude={[
                            "version",
                            "sent_at",
                            "expires_at",
                            "responded_at",
                            "requested_facility",
                            "offered_facility",
                            "sent_by_user_id",
                            "responded_by_user_id",
                          ]}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-2xl shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <RectangleStackIcon className="h-4 w-4" />
                          Related Applications
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Applications tied to this contract</p>
                      </div>
                      <Badge variant="secondary" className="rounded-xl px-3 py-1">
                        {data.applications.length} {data.applications.length === 1 ? "application" : "applications"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-sm font-semibold pl-6">Application Ref</TableHead>
                          <TableHead className="text-sm font-semibold">Requested Amount</TableHead>
                          <TableHead className="text-sm font-semibold">Submitted</TableHead>
                          <TableHead className="text-sm font-semibold">Status</TableHead>
                          <TableHead className="text-sm font-semibold">Updated</TableHead>
                          <TableHead className="text-sm font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.applications.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                              No linked applications
                            </TableCell>
                          </TableRow>
                        ) : (
                          data.applications.map((application) => (
                            <TableRow key={application.id} className="odd:bg-muted/40 hover:bg-muted">
                              <TableCell className="text-sm font-medium pl-6">
                                {application.id.slice(-8).toUpperCase()}
                              </TableCell>
                              <TableCell className="text-sm font-semibold">
                                {formatCurrency(application.requestedAmount)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {application.submittedAt
                                  ? format(new Date(application.submittedAt), "dd MMM yyyy")
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <ApplicationStatusBadge status={application.status} />
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {format(new Date(application.updatedAt), "dd MMM yyyy")}
                              </TableCell>
                              <TableCell>
                                {application.productId ? (
                                  <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                                    <Link href={`/applications/${application.productId}/${application.id}`}>
                                      Review
                                    </Link>
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="sm" className="h-8 px-2" disabled>
                                    Review
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
