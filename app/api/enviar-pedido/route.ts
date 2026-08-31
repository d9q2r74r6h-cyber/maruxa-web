export async function POST() {
  return Response.json(
    { error: 'Endpoint reemplazado por la creación segura de pedidos.' },
    { status: 410 }
  );
}
