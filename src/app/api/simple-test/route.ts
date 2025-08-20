// 가장 기본적인 API 테스트
export async function GET() {
  return new Response('GET method works!', { 
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}

export async function POST() {
  return new Response('POST method works!', { 
    status: 200,
    headers: { 'Content-Type': 'text/plain' }
  });
}

export async function OPTIONS() {
  return new Response(null, { 
    status: 200,
    headers: { 
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
