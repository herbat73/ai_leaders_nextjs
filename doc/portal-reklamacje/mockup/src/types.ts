// Model domenowy mockupu — odpowiada docs/05-katalog-api.md

type Role = 'CUSTOMER' | 'AGENT' | 'WAREHOUSE' | 'SUPPLIER';
type ClaimKind = 'RETURN' | 'COMPLAINT' | 'TRANSPORT' | 'MISSING';
type ClaimStatus = 'SUBMITTED' | 'AWAITING_CUSTOMER' | 'APPROVED' | 'IN_TRANSIT' | 'RECEIVED' | 'IN_SERVICE' | 'RESOLVED' | 'REJECTED' | 'CANCELLED';
type Resolution = 'REFUND' | 'STORE_CREDIT' | 'EXCHANGE' | 'REPLACEMENT' | 'REPAIR' | 'PRICE_REDUCTION' | 'SPARE_PART';
type ReturnMethod = 'PARCEL_LOCKER' | 'COURIER' | 'STORE' | 'NONE';
type Category = 'ELECTRONICS' | 'APPLIANCES' | 'HOME' | 'APPAREL' | 'HYGIENE';
type Channel = 'PORTAL' | 'PHONE' | 'STORE' | 'EMAIL';
type Scenario = 'normal' | 'slow' | 'empty' | 'error';
type RuleAction = 'AUTO_APPROVE' | 'KEEP_ITEM' | 'HIGH_PRIORITY' | 'ASSIGN_TEAM' | 'REQUIRE_VIDEO';

interface Session {
  role: Role;
  name: string;
  email?: string;        // klient z kontem / gość
  orderId?: string;      // gość: zakres jednego zamówienia
  claimId?: string;      // dostęp przez „sprawdź status”
  supplierId?: string;
  assisted?: { orderId: string; channel: Channel; customerName: string };
}

interface OrderLine {
  lineId: string; sku: string; name: string; variant: string; emoji: string; qty: number; price: number;
  category: Category; supplierId: string; serialRequired: boolean; returnable: boolean;
  exchangeVariants?: { label: string; inStock: boolean }[];
}

interface Order {
  id: string; number: string; email: string; phone: string; customerName: string;
  placedAt: string; deliveredAt: string | null; paymentMethod: 'CARD' | 'BLIK' | 'COD';
  address: { street: string; zip: string; city: string };
  lines: OrderLine[];
}

interface FileMeta {
  id: string; name: string; size: number; mime: string;
  status: 'uploading' | 'scanning' | 'ready' | 'error'; error?: string; progress: number;
}

interface ClaimItem {
  lineId: string; sku: string; name: string; variant: string; emoji: string; qty: number; price: number; category: Category; supplierId: string;
  reason: string; description: string; detectedAt: string; serial: string; missingPart: string; files: FileMeta[];
}

interface TimelineEntry { at: string; status: ClaimStatus; title: string; description?: string; actor: string }
interface Message { id: string; from: 'CUSTOMER' | 'AGENT' | 'SYSTEM'; author: string; body: string; at: string; internal?: boolean }
interface Offer { resolution: Resolution; amount: number; text: string; status: 'PENDING' | 'ACCEPTED' | 'DECLINED' }

interface Inspection {
  at: string; by: string; condition: 'NEW' | 'OPENED' | 'USED' | 'DAMAGED'; complete: boolean; grade: 'A' | 'B' | 'C';
  defectConfirmed: 'yes' | 'no' | 'na'; disposition: 'RESTOCK' | 'OUTLET' | 'SUPPLIER' | 'SCRAP'; qtyReceived: number; notes: string;
}

interface Claim {
  id: string; number: string; kind: ClaimKind; status: ClaimStatus; channel: Channel;
  orderId: string; orderNumber: string; customerName: string; email: string; phone: string;
  createdAt: string; responseDueAt: string;
  items: ClaimItem[];
  resolution: Resolution; exchangeVariant?: string; resolutionNote?: string;
  returnMethod: ReturnMethod; pickupPoint?: string; store?: string; courier?: { street: string; zip: string; city: string; date: string };
  refundAccount?: string;
  value: number; refundAmount: number;
  priority: 'NORMAL' | 'HIGH'; team: string; assignee?: string; tags: string[];
  appliedRules: string[]; keepItem: boolean;
  label?: { carrier: string; code: string; expiresAt: string };
  timeline: TimelineEntry[]; messages: Message[];
  requestedInfo?: string[]; offer?: Offer; rejectReason?: string;
  inspection?: Inspection;
  outcome?: { type: 'REFUND' | 'STORE_CREDIT' | 'REPLACEMENT' | 'REPAIR' | 'SPARE_PART' | 'PRICE_REDUCTION'; amount?: number; ref?: string; at: string };
  supplierClaimId?: string;
  customerReplied?: boolean;
}

interface Supplier { id: string; name: string; warrantyMonths: number; requires: ('SERIAL' | 'VIDEO' | 'PHOTO' | 'INSPECTION')[]; contact: string }

interface SupplierClaim {
  id: string; number: string; supplierId: string; status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CREDITED';
  claimIds: string[]; amount: number; createdAt: string; sentAt?: string;
  response?: { decision: 'ACCEPT' | 'REJECT'; creditAmount?: number; creditNoteNo?: string; reason?: string; at: string };
}

interface Rule {
  id: string; name: string; enabled: boolean; order: number;
  conditions: { kinds: ClaimKind[]; categories: Category[]; reasons: string[]; minValue: number | null; maxValue: number | null; maxDays: number | null };
  action: RuleAction; param: string; hits: number;
}

interface Template { id: string; name: string; body: string }

interface Policy { returnDays: number; returnFee: number; freeReturnForCredit: boolean; creditBonus: number; excludedCategories: Category[]; transportDays: number }

interface DraftData {
  orderId: string; kind: ClaimKind | ''; items: ClaimItem[];
  resolution: Resolution | ''; exchangeVariant: string; refundJustification: string;
  returnMethod: ReturnMethod | ''; pickupPoint: string; store: string;
  courier: { street: string; zip: string; city: string; date: string };
  refundAccount: string; contact: { email: string; phone: string };
  consents: { truthful: boolean; withdrawal: boolean; confirmedByCustomer: boolean };
}

interface Draft { id: string; step: number; updatedAt: string; data: DraftData }

interface Db {
  version: number;
  session: Session | null;
  orders: Order[];
  claims: Claim[];
  suppliers: Supplier[];
  supplierClaims: SupplierClaim[];
  rules: Rule[];
  templates: Template[];
  policy: Policy;
  draft: Draft | null;
  lastClaimId: string | null;
  seq: number;
}

interface FieldError { field: string; message: string }
