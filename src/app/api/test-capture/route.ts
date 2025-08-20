import { NextRequest, NextResponse } from 'next/server';
import { captureStore } from '@/lib/capture-store';
import JSZip from 'jszip';

// 테스트용 목업 캡처 생성
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // 테스트용 세션 ID 생성
    const sessionId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Test Capture] Creating test session: ${sessionId} for URL: ${url}`);
    
    // 즉시 완료된 상태로 목업 데이터 생성
    const mockZipBuffer = await createMockZip(sessionId, url);
    
    const mockResult = {
      sessionId,
      baseUrl: url,
      capturedPages: [
        { url, filename: '01_homepage.png', success: true },
        { url: url + '/about', filename: '02_about.png', success: true },
        { url: url + '/contact', filename: '03_contact.png', success: false, error: 'Page not found' }
      ],
      zipBuffer: mockZipBuffer,
      totalPages: 3,
      successCount: 2,
      failureCount: 1
    };
    
    // 완료된 상태로 저장
    captureStore.set(sessionId, {
      status: 'completed',
      result: mockResult,
      createdAt: new Date()
    });
    
    console.log(`[Test Capture] Test session created and completed: ${sessionId}`);
    
    return NextResponse.json({
      sessionId,
      baseUrl: url,
      status: 'completed',
      message: '테스트 캡처가 완료되었습니다.',
      totalPages: 3,
      successCount: 2,
      failureCount: 1
    });
    
  } catch (error) {
    console.error('Test Capture API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

async function createMockZip(sessionId: string, url: string): Promise<Buffer> {
  const zip = new JSZip();
  
  // 실제 PNG 헤더를 가진 목업 이미지 데이터 생성
  const createMockPNG = (text: string): Buffer => {
    // 최소한의 PNG 구조 (1x1 픽셀 흰색 이미지)
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdrChunk = Buffer.from([
      0x00, 0x00, 0x00, 0x0D, // 길이 (13 bytes)
      0x49, 0x48, 0x44, 0x52, // IHDR
      0x00, 0x00, 0x00, 0x01, // 너비 (1)
      0x00, 0x00, 0x00, 0x01, // 높이 (1)
      0x08, 0x02, 0x00, 0x00, 0x00, // 비트 깊이, 컬러 타입 등
      0x90, 0x77, 0x53, 0xDE  // CRC
    ]);
    const idatChunk = Buffer.from([
      0x00, 0x00, 0x00, 0x0C, // 길이 (12 bytes)
      0x49, 0x44, 0x41, 0x54, // IDAT
      0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
      0xE5, 0x27, 0xDE, 0xFC  // CRC
    ]);
    const iendChunk = Buffer.from([
      0x00, 0x00, 0x00, 0x00, // 길이 (0 bytes)
      0x49, 0x45, 0x4E, 0x44, // IEND
      0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    
    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
  };
  
  zip.file('01_homepage.png', createMockPNG('homepage'));
  zip.file('02_about.png', createMockPNG('about'));
  
  // 메타데이터
  const metadata = {
    sessionId,
    capturedAt: new Date().toISOString(),
    totalPages: 3,
    successCount: 2,
    failureCount: 1,
    pages: [
      { url, filename: '01_homepage.png', success: true },
      { url: url + '/about', filename: '02_about.png', success: true },
      { url: url + '/contact', filename: '03_contact.png', success: false, error: 'Page not found' }
    ]
  };
  
  zip.file('metadata.json', JSON.stringify(metadata, null, 2));
  zip.file('failures.txt', 'URL: ' + url + '/contact\nError: Page not found\n---');
  
  return await zip.generateAsync({ type: 'nodebuffer' });
}
