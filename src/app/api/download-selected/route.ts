import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { sessionStore } from '@/lib/session-store';

export async function POST(request: NextRequest) {
  try {
    console.log('[Download Selected] API 호출 시작');
    
    const body = await request.json();
    const { sessionId, selectedIndices } = body;

    if (!sessionId || !selectedIndices || !Array.isArray(selectedIndices)) {
      return NextResponse.json({ 
        error: 'sessionId와 selectedIndices 배열이 필요합니다.' 
      }, { status: 400 });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json({ 
        error: '세션을 찾을 수 없습니다.' 
      }, { status: 404 });
    }

    if (session.status !== 'completed') {
      return NextResponse.json({ 
        error: '아직 캡처가 완료되지 않았습니다.' 
      }, { status: 400 });
    }

    console.log(`[Download Selected] ${sessionId}: ${selectedIndices.length}개 이미지 선택됨`);

    // ZIP 파일 생성
    const zip = new JSZip();
    let addedCount = 0;

    for (const index of selectedIndices) {
      if (index >= 0 && index < session.screenshots.length) {
        const screenshot = session.screenshots[index];
        
        if (screenshot.buffer && screenshot.buffer.length > 0) {
          zip.file(screenshot.filename, screenshot.buffer);
          addedCount++;
          console.log(`[Download Selected] ${sessionId}: ${screenshot.filename} 추가됨`);
        } else {
          console.log(`[Download Selected] ${sessionId}: ${screenshot.filename} 건너뜀 (빈 파일)`);
        }
      }
    }

    if (addedCount === 0) {
      return NextResponse.json({ 
        error: '선택된 이미지가 없거나 모두 빈 파일입니다.' 
      }, { status: 400 });
    }

    // ZIP 버퍼 생성
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    console.log(`[Download Selected] ${sessionId}: ZIP 생성 완료 (${zipBuffer.length}바이트, ${addedCount}개 파일)`);

    // ZIP 파일명 생성
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `selected_screenshots_${timestamp}.zip`;

    // 응답 헤더 설정
    const response = new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
        'Cache-Control': 'no-cache'
      }
    });

    return response;

  } catch (error) {
    console.error('[Download Selected] 오류:', error);
    return NextResponse.json({
      error: '선택적 다운로드 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const index = searchParams.get('index');

    if (!sessionId || index === null) {
      return NextResponse.json({ 
        error: 'sessionId와 index가 필요합니다.' 
      }, { status: 400 });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      return NextResponse.json({ 
        error: '세션을 찾을 수 없습니다.' 
      }, { status: 404 });
    }

    const screenshotIndex = parseInt(index);
    if (screenshotIndex < 0 || screenshotIndex >= session.screenshots.length) {
      return NextResponse.json({ 
        error: '유효하지 않은 인덱스입니다.' 
      }, { status: 400 });
    }

    const screenshot = session.screenshots[screenshotIndex];
    if (!screenshot.buffer || screenshot.buffer.length === 0) {
      return NextResponse.json({ 
        error: '이미지 데이터가 없습니다.' 
      }, { status: 404 });
    }

    // 개별 이미지 반환 (미리보기용)
    return new NextResponse(screenshot.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('[Download Selected] 이미지 조회 오류:', error);
    return NextResponse.json({
      error: '이미지 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
