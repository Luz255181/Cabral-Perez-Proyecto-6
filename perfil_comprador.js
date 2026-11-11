import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Configuración del script y Umbrales de Calidad (Thresholds)
export const options = {
  // Escenario de Carga Constante: Ramp-up (2m) -> Steady state (5m) -> Ramp-down (1m)
  stages: [
    { duration: '2m', target: 20 }, // Sube gradualmente a 20 VUs en 2 min
    { duration: '5m', target: 20 }, // Mantiene 20 VUs constantes durante 5 min
    { duration: '1m', target: 0  }, // Baja gradualmente a 0 VUs en 1 min
  ],

  // Umbrales exigidos por el enunciado del proyecto
  thresholds: {
    'http_req_duration': ['p(95)<400'],                   // 95% de las peticiones globales en < 400ms
    'http_req_duration{name:POST /orders}': ['p(90)<800'], // 90% del checkout POST /orders en < 800ms
    'http_req_failed': ['rate<0.01'],                       // Tasa de errores HTTP < 1%
    'checks': ['rate>0.99'],                                // Aserciones exitosas > 99%
  },
};

const BASE_URL = 'https://simple-books-api.click';

export default function () {
  let accessToken = '';
  let selectedBookId = null;

  // 1. Consultar el catálogo y seleccionar un libro disponible (available: true)
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

  // Fallback si no encuentra disponible
  if (!selectedBookId) {
    selectedBookId = 1;
  }

  // Think time aleatorio
  sleep(Math.random() * 2 + 1);

  // 2. Registrar cliente en /api-clients con email dinámico y único
  group('02. Registrar Cliente Dinámico', function () {
    const uniqueId = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
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

  // 3. Realizar orden de compra en POST /orders (requiere Bearer token)
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

    // 4. Consultar órdenes activas en GET /orders
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

// Generación automática del reporte JSON
export function handleSummary(data) {
  return {
    'summary_perfil_comprador.json': JSON.stringify(data, null, 2),
  };
}
