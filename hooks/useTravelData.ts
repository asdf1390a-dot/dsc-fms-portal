import { useEffect, useState, useCallback } from 'react';
import { Travel, ApiResponse, ApiResponseList } from '@/types/travel';
import { supabase } from '@/lib/supabase';

interface UseTravelDataOptions {
  autoFetch?: boolean;
  refreshInterval?: number;
}

interface UseTravelDataReturn {
  travel: Travel | null;
  travels: Travel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateTravel: (data: Partial<Travel>) => Promise<Travel>;
  deleteTravel: () => Promise<void>;
}

interface UseTravelsListReturn {
  travels: Travel[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const getAuthHeaders = async (): Promise<{ 'x-user-id': string; 'Authorization': string } | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const token = session.access_token;
    return {
      'x-user-id': session.user.id,
      'Authorization': `Bearer ${token}`,
    };
  } catch (error) {
    console.error('Auth headers error:', error);
    return null;
  }
};

export function useTravelData(
  travelId: string,
  options: UseTravelDataOptions = { autoFetch: true }
): UseTravelDataReturn {
  const [travel, setTravel] = useState<Travel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTravel = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      if (!headers) {
        setError('Not authenticated');
        return;
      }

      const response = await fetch(`/api/travels/${travelId}`, {
        headers,
      });

      const data: ApiResponse<Travel> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch travel');
      }

      setTravel(data.data || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Fetch travel error:', err);
    } finally {
      setLoading(false);
    }
  }, [travelId]);

  useEffect(() => {
    if (options.autoFetch && travelId) {
      fetchTravel();
    }
  }, [travelId, options.autoFetch, fetchTravel]);

  const updateTravel = useCallback(
    async (updateData: Partial<Travel>): Promise<Travel> => {
      try {
        const headers = await getAuthHeaders();
        if (!headers) throw new Error('Not authenticated');

        const response = await fetch(`/api/travels/${travelId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(updateData),
        });

        const data: ApiResponse<Travel> = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update travel');
        }

        const updated = data.data!;
        setTravel(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
        throw err;
      }
    },
    [travelId]
  );

  const deleteTravel = useCallback(async () => {
    try {
      const headers = await getAuthHeaders();
      if (!headers) throw new Error('Not authenticated');

      const response = await fetch(`/api/travels/${travelId}`, {
        method: 'DELETE',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete travel');
      }

      setTravel(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      throw err;
    }
  }, [travelId]);

  return {
    travel,
    travels: travel ? [travel] : [],
    loading,
    error,
    refetch: fetchTravel,
    updateTravel,
    deleteTravel,
  };
}

export function useTravelsList(
  status?: 'upcoming' | 'ongoing' | 'completed',
  sortBy: 'date' | 'cost' | 'name' = 'date'
): UseTravelsListReturn {
  const [travels, setTravels] = useState<Travel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTravels = useCallback(async () => {
    try {
      setLoading(true);
      const headers = await getAuthHeaders();
      if (!headers) {
        setError('Not authenticated');
        return;
      }

      const params = new URLSearchParams();
      if (status) params.append('status', status);
      params.append('sort_by', sortBy);

      const response = await fetch(`/api/travels?${params}`, {
        headers,
      });

      const data: ApiResponseList<Travel> = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch travels');
      }

      setTravels(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Fetch travels error:', err);
    } finally {
      setLoading(false);
    }
  }, [status, sortBy]);

  useEffect(() => {
    fetchTravels();
  }, [fetchTravels]);

  return {
    travels,
    loading,
    error,
    refetch: fetchTravels,
  };
}
