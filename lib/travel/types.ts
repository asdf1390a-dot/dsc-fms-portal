export interface Travel {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  location: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface TravelMember {
  id: string;
  travel_id: string;
  user_id: string;
  role: 'organizer' | 'companion' | 'guest';
  permission: 'read_only' | 'read_write';
  joined_at: string;
}

export interface TravelEvent {
  id: string;
  travel_id: string;
  title: string;
  event_type: 'flight' | 'hotel' | 'meal' | 'transport' | 'other';
  event_date: string;
  event_time?: string;
  location?: string;
  description?: string;
  details?: Record<string, any>;
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
  currency: 'INR' | 'USD' | 'EUR' | 'KRW';
  cost_type: 'flight' | 'accommodation' | 'meal' | 'transport' | 'activity' | 'shopping' | 'other';
  payment_method: 'card' | 'cash' | 'bank_transfer' | 'upi';
  cost_date: string;
  created_at: string;
  updated_at: string;
}

export interface TravelChecklistItem {
  id: string;
  travel_id: string;
  title: string;
  category: 'documents' | 'clothing' | 'toiletries' | 'electronics' | 'medicine' | 'custom';
  is_completed: boolean;
  notes?: string;
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TravelDocument {
  id: string;
  travel_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  document_type: 'visa' | 'passport' | 'flight_ticket' | 'hotel_booking' | 'receipt' | 'other';
  uploaded_by: string;
  uploaded_at: string;
  public_url?: string;
}

export interface NotificationRule {
  id: string;
  travel_id: string;
  rule_type: string;
  rule_config: Record<string, any>;
  is_enabled: boolean;
  created_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
  message?: string;
}
