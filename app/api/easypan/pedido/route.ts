export async function POST() {
  return Response.json(
    { error: 'Integración EasyPan no habilitada.' },
    { status: 501 }
  );
}
