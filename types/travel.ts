// Travel Management Module — TypeScript Types

export interface Travel {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  location: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
  // Relations (optional, populated on detail view)
  members?: TravelMember[];
  events?: TravelEvent[];
  costs?: TravelCost[];
  checklist_items?: TravelChecklistItem[];
  documents?: TravelDocument[];
  notification_rules?: TravelNotificationRule[];
}

export interface TravelMember {
  id: string;
  travel_id: string;
  user_id: string;
  role: 'organizer' | 'companion' | 'guest';
  permission: 'read_only' | 'read_write';
  joined_at: string;
  // User info (optional, populated on join)
  user?: {
    id: string;
    email: string;
    user_metadata?: {
      name?: string;
      avatar_url?: string;
    };
  };
}

export interface TravelEvent {
  id: string;
  travel_id: string;
  title: string;
  event_type: 'flight' | 'hotel' | 'meal' | 'transport' | 'other';
  event_date: string; // YYYY-MM-DD
  event_time?: string; // HH:MM
  location?: string;
  description?: string;
  details?: Record<string, any>; // Flight: {flight_number, airline, departure_airport, arrival_airport}; Hotel: {check_in, check_out, hotel_name}
  status: 'planned' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface TravelCost {
  id: string;
  travel_id: string;
  payer_id: string;
  title: string;
  amount: number;
  currency: string; // INR, USD, etc.
  cost_type?: 'flight' | 'accommodation' | 'meal' | 'transport' | 'other';
  payment_method?: 'card' | 'cash' | 'bank_transfer';
  cost_date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  // Relations (optional)
  splits?: TravelCostSplit[];
}

export interface TravelCostSplit {
  id: string;
  cost_id: string;
  member_id: string; // Reference to travel_members.id
  amount: number;
}

export interface TravelChecklistItem {
  id: string;
  travel_id: string;
  title: string;
  category?: 'documents' | 'clothing' | 'toiletries' | 'electronics' | 'medicine' | 'custom';
  is_completed: boolean;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TravelDocument {
  id: string;
  travel_id: string;
  file_name: string;
  file_path: string; // Supabase Storage path
  file_size: number;
  file_type: string; // e.g., 'pdf', 'jpg', 'png'
  document_type?: 'visa' | 'passport' | 'flight_ticket' | 'hotel_booking' | 'receipt' | 'other';
  uploaded_by: string;
  uploaded_at: string;
}

export interface TravelNotification {
  id: string;
  travel_id: string;
  user_id: string;
  notification_type: 'auto_rule' | 'custom';
  title: string;
  message: string;
  trigger_date?: string;
  trigger_time?: string;
  channels: {
    in_app?: boolean;
    email?: boolean;
    telegram?: boolean;
  };
  is_sent: boolean;
  sent_at?: string;
  created_at: string;
}

export interface TravelNotificationRule {
  id: string;
  travel_id: string;
  rule_type: 'days_before_departure' | 'event_time' | 'checklist_reminder' | 'custom';
  rule_config: {
    days?: number; // For "days_before_departure"
    channels?: ('in_app' | 'email' | 'telegram')[];
    [key: string]: any;
  };
  is_enabled: boolean;
  created_at: string;
}

// Settlement calculation
export interface SettlementRecord {
  member_id: string;
  member_name?: string;
  total_paid: number; // Total amount paid by this member
  share: number; // Total share (amount member should pay)
  balance: number; // balance = total_paid - share. If negative, member owes. If positive, member is owed.
}

export interface SettlementSummary {
  settlement: SettlementRecord[];
  total_cost: number;
  currency: string;
}

// API Request/Response types

export interface CreateTravelRequest {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  location: string;
}

export interface CreateTravelMemberRequest {
  user_id: string;
  role?: 'organizer' | 'companion' | 'guest';
  permission?: 'read_only' | 'read_write';
}

export interface CreateTravelEventRequest {
  title: string;
  event_type: 'flight' | 'hotel' | 'meal' | 'transport' | 'other';
  event_date: string;
  event_time?: string;
  location?: string;
  description?: string;
  details?: Record<string, any>;
}

export interface CreateTravelCostRequest {
  title: string;
  amount: number;
  currency?: string;
  cost_type?: string;
  payment_method?: string;
  cost_date: string;
  splits?: Array<{
    member_id: string;
    amount: number;
  }>;
}

export interface CreateChecklistItemRequest {
  title: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}

export type ApiResponseList<T> = ApiResponse<T[]>;
