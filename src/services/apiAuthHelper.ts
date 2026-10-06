import { auth } from '../firebase/config';

let cachedApiToken: string | null = null;
let cachedTokenExpiry = 0;

/**
 * Obtém o cabeçalho Authorization com token JWT ou Firebase Auth Bearer assinado
 */
export async function getApiAuthHeaders(
  companyId: string = 'comp-translog-01',
  userId: string = 'usr-admin-translog',
  role: string = 'administrativo'
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'x-company-id': companyId,
    'x-user-id': userId,
  };

  // 1. Tentar token do Firebase Auth (se logado via Google ou Email)
  try {
    if (auth.currentUser) {
      const fbToken = await auth.currentUser.getIdToken();
      if (fbToken) {
        headers['Authorization'] = `Bearer ${fbToken}`;
        return headers;
      }
    }
  } catch (e) {
    console.warn('[AuthHelper] Falha ao obter Firebase ID token:', e);
  }

  // 2. Tentar token em cache válido
  const now = Math.floor(Date.now() / 1000);
  if (cachedApiToken && cachedTokenExpiry > now + 60) {
    headers['Authorization'] = `Bearer ${cachedApiToken}`;
    return headers;
  }

  // 3. Tentar token salvo no localStorage se presente
  try {
    const stored = localStorage.getItem('frotafacil_jwt_token');
    if (stored) {
      headers['Authorization'] = `Bearer ${stored}`;
      return headers;
    }
  } catch {
    // localStorage inacessível ou restrito
  }

  // 4. Solicitar token assinado criptograficamente ao backend
  try {
    const res = await fetch('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, userId, role }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        cachedApiToken = data.token;
        cachedTokenExpiry = now + 7 * 24 * 3600;
        try {
          localStorage.setItem('frotafacil_jwt_token', data.token);
        } catch {}
        headers['Authorization'] = `Bearer ${data.token}`;
      }
    }
  } catch (err) {
    console.warn('[AuthHelper] Aviso ao solicitar token assinado do backend:', err);
  }

  return headers;
}
