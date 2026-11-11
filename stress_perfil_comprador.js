import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Configuración de la Prueba de Punto de Quiebre (Stress / Breakpoint Test)
export const options = {
  // Incremento continuo de carga de 10 a 500 VUs para hallar el punto de quiebre (knee point)
  stages: [
    { duration: '1m', target: 50 },   // Ramp-up inicial a 50 VUs
    { duration: '2m', target: 100 },  // Incremento a 100 VUs
    { duration: '2m', target: 250 },  // Incremento a 250 VUs
    { duration: '2m', target: 500 },  // Carga máxima de 500 VUs
    { duration: '1m', target: 0 },    // Bajada final
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

  // 1. Consultar el catálogo y seleccionar un libro disponible
  group('01. Consultar Catálogo y Buscar Libro Disponible', function () {
    const res = http.get(`${BASE_URL}/books`, { tags: { name: 'GET /books' } });
    const isOk = check(res, {
      'catálogo responde 200': (r) => r.status === 200,
    });

    if (isOk && res.json()) {
      const books = res.json();
      const availableBook = books.find((b) => b.available === true);
      if (availableBook) {
        selectedBookId = availableBook.id;
      }
    }
  });

  if (!selectedBookId) {
    selectedBookId = 1;
  }

  sleep(Math.random() * 2 + 1);

  // 2. Registrar cliente dinámico
  group('02. Registrar Cliente Dinámico', function () {
    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
    const payload = JSON.stringify({
      clientName: `Comprador_${uniqueId}`,
      clientEmail: `comprador_${uniqueId}@testk6.com`,
    });

    const headers = { 'Content-Type': 'application/json' };
    const res = http.post(`${BASE_URL}/api-clients`, payload, {
      headers: headers,
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

  // 3. Realizar orden de compra
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
      });
    });

    sleep(Math.random() * 2 + 1);

    // 4. Consultar órdenes activas
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
      });
    });

    sleep(Math.random() * 2 + 1);
  }
}

export function handleSummary(data) {
  return {
    'summary_stress_comprador.json': JSON.stringify(data, null, 2),
  };
}
