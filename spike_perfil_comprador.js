import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Escenario de Avalancha (Spike Test) - Perfil Comprador
export const options = {
  stages: [
    { duration: '10s', target: 5 },    // Tráfico normal inicial
    { duration: '10s', target: 100 },  // Salto brusco de 5 a 100 VUs en 10s (Spike)
    { duration: '3m',  target: 100 },  // Mantiene el pico de 100 VUs durante 3 min
    { duration: '10s', target: 5 },    // Bajada rápida para evaluar si se recupera
    { duration: '3m',  target: 5 },    // Período de observación de recuperación
  ],

  thresholds: {
    'http_req_duration': ['p(95)<400'],
    'http_req_duration{name:POST /orders}': ['p(90)<800'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

const BASE_URL = 'https://simple-books-api.click';

export default function () {
  let accessToken = '';
  let selectedBookId = null;

  group('01. Consultar Catálogo y Buscar Libro Disponible', function () {
    const res = http.get(`${BASE_URL}/books`, { tags: { name: 'GET /books' } });
    const isOk = check(res, { 'catálogo responde 200': (r) => r.status === 200 });
    if (isOk && res.json()) {
      const books = res.json();
      const availableBook = books.find((b) => b.available === true);
      if (availableBook) selectedBookId = availableBook.id;
    }
  });

  if (!selectedBookId) selectedBookId = 1;
  sleep(Math.random() * 2 + 1);

  group('02. Registrar Cliente Dinámico', function () {
    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const payload = JSON.stringify({
      clientName: `Comprador_${uniqueId}`,
      clientEmail: `comprador_${uniqueId}@testk6.com`,
    });

    const res = http.post(`${BASE_URL}/api-clients`, payload, {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api-clients' },
    });

    const isOk = check(res, {
      'registro exitoso (201)': (r) => r.status === 201,
      'obtiene accessToken': (r) => r.json() && r.json().accessToken !== undefined,
    });

    if (isOk && res.json() && res.json().accessToken) {
      accessToken = res.json().accessToken;
    }
  });

  sleep(Math.random() * 2 + 1);

  if (accessToken) {
    group('03. Realizar Orden de Compra', function () {
      const payload = JSON.stringify({
        bookId: selectedBookId,
        customerName: 'Cliente K6',
      });

      const params = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: 'POST /orders' },
      };

      const res = http.post(`${BASE_URL}/orders`, payload, params);

      check(res, {
        'orden creada (201)': (r) => r.status === 201,
        'devuelve confirmación de orden': (r) => r.json() && r.json().created === true,
      });
    });

    sleep(Math.random() * 2 + 1);

    group('04. Consultar Órdenes Activas', function () {
      const params = {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        tags: { name: 'GET /orders' },
      };

      const res = http.get(`${BASE_URL}/orders`, params);

      check(res, {
        'órdenes obtenidas (200)': (r) => r.status === 200,
        'devuelve lista de órdenes': (r) => Array.isArray(r.json()),
      });
    });

    sleep(Math.random() * 2 + 1);
  }
}

export function handleSummary(data) {
  return {
    'summary_spike_comprador.json': JSON.stringify(data, null, 2),
  };
}
