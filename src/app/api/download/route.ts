import { NextRequest, NextResponse } from 'next/server';
import { captureStore } from '@/lib/capture-store';
import JSZip from 'jszip';

// HEAD 요청 처리 (파일 크기 확인용)
export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  if (!sessionId) {
    return new NextResponse(null, { status: 400 });
  }
  
  const captureInfo = captureStore.get(sessionId);
  
  if (!captureInfo || captureInfo.status !== 'completed') {
    return new NextResponse(null, { status: 404 });
  }
  
  // 대략적인 파일 크기 추정 (이미지 개수 * 평균 크기)
  const estimatedSize = captureInfo.result?.crawledPages?.length * 500000 || 1000000; // 500KB per image
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Length': estimatedSize.toString()
    }
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const selectedFiles = searchParams.get('selectedFiles');
    
    console.log(`[Download API] GET 요청 - sessionId: ${sessionId}`);
    console.log(`[Download API] 선택된 파일들: ${selectedFiles}`);
    
    if (!sessionId) {
      console.error('[Download API] No sessionId provided');
      return NextResponse.json({ 
        error: 'Session ID is required',
        details: 'sessionId query parameter is missing'
      }, { status: 400 });
    }

    // 캡처 작업 상태 확인
    const captureInfo = captureStore.get(sessionId);
    
    if (!captureInfo) {
      console.error(`[Download API] Session not found: ${sessionId}`);
      
      // 디버깅용 전체 세션 목록 로그
      const allSessions = captureStore.getAllSessions();
      console.log('[Download API] Available sessions:', Object.keys(allSessions));
      
      return NextResponse.json({ 
        error: 'Session not found',
        sessionId,
        availableSessions: Object.keys(allSessions),
        details: 'The requested session does not exist or has expired'
      }, { status: 404 });
    }
    
    console.log(`[Download API] Session found: ${sessionId}`, { status: captureInfo.status });
    
    if (captureInfo.status === 'processing') {
      return NextResponse.json({ 
        error: 'Capture still in progress',
        status: 'processing' 
      }, { status: 425 }); // Too Early
    }
    
    if (captureInfo.status === 'failed') {
      return NextResponse.json({ 
        error: 'Capture failed',
        details: captureInfo.error 
      }, { status: 500 });
    }
    
    if (captureInfo.status === 'completed' && captureInfo.result) {
      // Auto-capture 결과인 경우 선택적 ZIP 생성
      if (sessionId.startsWith('autocapture_') && captureInfo.result.crawledPages) {
        const zipBuffer = await createSelectedZip(captureInfo.result.crawledPages, selectedFiles);
        
        if (!zipBuffer) {
          return NextResponse.json({ error: 'Failed to create ZIP file' }, { status: 500 });
        }
        
        const response = new NextResponse(zipBuffer as unknown as BodyInit);
        response.headers.set('Content-Type', 'application/zip');
        response.headers.set('Content-Disposition', `attachment; filename="auto_capture_${sessionId}.zip"`);
        response.headers.set('Content-Length', zipBuffer.length.toString());
        
        // 다운로드 후 캐시에서 제거
        setTimeout(() => {
          captureStore.delete(sessionId);
        }, 60000);
        
        return response;
      }
      
      // 기존 로직 (이전 버전 호환성)
      const zipBuffer = captureInfo.result.zipBuffer;
      if (!zipBuffer) {
        return NextResponse.json({ error: 'No data available' }, { status: 404 });
      }
      
      const response = new NextResponse(zipBuffer as unknown as BodyInit);
      response.headers.set('Content-Type', 'application/zip');
      
      // 세션 ID로 파일명 결정
      let filename = 'screenshots.zip';
      if (sessionId.startsWith('discover_')) {
        filename = `discovered_links_${sessionId}.zip`;
      } else if (sessionId.startsWith('capture_')) {
        filename = `selected_screenshots_${sessionId}.zip`;
      } else {
        filename = `screenshots_${sessionId}.zip`;
      }
      
      response.headers.set('Content-Disposition', `attachment; filename="${filename}"`);
      response.headers.set('Content-Length', zipBuffer.length.toString());
      
      // 다운로드 후 캐시에서 제거 (메모리 절약)
      setTimeout(() => {
        captureStore.delete(sessionId);
      }, 60000); // 1분 후 삭제
      
      return response;
    }
    
    return NextResponse.json({ error: 'No data available' }, { status: 404 });
    
  } catch (error) {
    console.error('Download API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

async function createSelectedZip(crawledPages: any[], selectedFiles: string | null): Promise<Buffer | null> {
  try {
    console.log(`[Download API] ZIP 생성 시작`);
    console.log(`[Download API] - 전체 크롤링 페이지: ${crawledPages.length}개`);
    console.log(`[Download API] - 선택된 파일 목록: ${selectedFiles}`);
    
    const zip = new JSZip();
    
    // 선택된 파일들만 필터링
    const selectedFilenames = selectedFiles ? selectedFiles.split(',') : [];
    console.log(`[Download API] - 파싱된 선택 파일명: ${selectedFilenames.length}개`);
    
    const selectedPages = crawledPages.filter(page => 
      page.success && selectedFilenames.includes(page.filename)
    );
    
    console.log(`[Download API] - 필터링된 성공 페이지: ${selectedPages.length}개`);
    
    // 디버깅: 각 페이지 상태 로그
    crawledPages.forEach((page, index) => {
      console.log(`[Download API] 페이지 ${index + 1}: ${page.filename}, 성공: ${page.success}, 이미지 크기: ${page.fullScreenshot ? page.fullScreenshot.length : 0} bytes`);
    });
    
    // 선택된 이미지들을 ZIP 루트에 직접 추가
    let addedCount = 0;
    let failedCount = 0;
    
    for (const page of selectedPages) {
      console.log(`[Download API] 이미지 처리 중: ${page.filename}`);
      
      if (!page.fullScreenshot) {
        console.error(`[Download API] 이미지 데이터 없음: ${page.filename}`);
        failedCount++;
        continue;
      }
      
      if (page.fullScreenshot.length === 0) {
        console.error(`[Download API] 빈 이미지 데이터: ${page.filename}`);
        failedCount++;
        continue;
      }
      
      try {
        // Buffer가 아닌 경우 Buffer로 변환
        const imageBuffer = Buffer.isBuffer(page.fullScreenshot) 
          ? page.fullScreenshot 
          : Buffer.from(page.fullScreenshot);
        
        if (imageBuffer.length === 0) {
          console.error(`[Download API] Buffer 변환 후 빈 데이터: ${page.filename}`);
          failedCount++;
          continue;
        }
        
        zip.file(page.filename, imageBuffer);
        addedCount++;
        console.log(`[Download API] 이미지 ZIP 추가 성공: ${page.filename} (${imageBuffer.length} bytes)`);
      } catch (bufferError) {
        console.error(`[Download API] Buffer 처리 실패: ${page.filename}`, bufferError);
        failedCount++;
      }
    }
    
    console.log(`[Download API] 이미지 추가 완료: 성공 ${addedCount}개, 실패 ${failedCount}개`);
    
    // 메타데이터 추가
    const metadata = {
      capturedAt: new Date().toISOString(),
      captureType: 'auto_capture_selected',
      totalSelected: selectedPages.length,
      selectedImages: selectedPages.map(page => ({
        order: page.order,
        url: page.url,
        filename: page.filename,
        title: page.title,
        depth: page.depth,
        imageSize: page.fullScreenshot ? page.fullScreenshot.length : 0
      }))
    };
    
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));
    
    // 캡처 요약 파일
    const summary = [
      '=== 자동 크롤링 스크린샷 캡처 결과 ===\n',
      `캡처 일시: ${new Date().toLocaleString('ko-KR')}`,
      `선택된 이미지: ${selectedPages.length}개`,
      `뷰포트: 1440px 고정 너비\n`,
      '=== 캡처된 페이지 목록 ===',
      ...selectedPages.map(page => 
        `${page.order}. ${page.title}\n   URL: ${page.url}\n   파일: ${page.filename}\n   깊이: ${page.depth}\n`
      )
    ].join('\n');
    
    zip.file('capture_summary.txt', summary);
    
    console.log(`[Download API] 메타데이터 및 요약 파일 추가 완료`);
    
    // ZIP 생성 시작
    console.log(`[Download API] ZIP 압축 시작 (총 ${addedCount}개 이미지 + 메타데이터)`);
    
    if (addedCount === 0) {
      console.error(`[Download API] 치명적 오류: ZIP에 추가된 이미지가 없습니다!`);
      return null;
    }
    
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    console.log(`[Download API] ZIP 생성 완료: ${zipBuffer.length} bytes`);
    
    // ZIP 내용 검증
    const zipFiles = Object.keys(zip.files);
    console.log(`[Download API] ZIP 내부 파일 목록 (${zipFiles.length}개):`, zipFiles);
    
    return zipBuffer;
    
  } catch (error) {
    console.error('[Download API] ZIP 생성 중 오류 발생:', error);
    console.error('[Download API] 오류 스택:', (error as Error).stack);
    return null;
  }
}
