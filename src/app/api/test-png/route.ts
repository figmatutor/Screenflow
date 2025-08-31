import { NextRequest, NextResponse } from 'next/server';
import { createSuccessResponse, createErrorResponse, createOptionsResponse } from '@/lib/api-utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testType = searchParams.get('type') || 'png';
  const format = searchParams.get('format') || 'binary';

  try {
    console.log(`[Test PNG API] 테스트 시작: type=${testType}, format=${format}`);

    if (testType === 'png') {
      // 실제 유효한 PNG 생성
      const pngBuffer = generateTestPng();
      
      if (format === 'base64') {
        // Base64로 인코딩하여 반환
        const base64String = pngBuffer.toString('base64');
        const dataUrl = `data:image/png;base64,${base64String}`;
        
        console.log(`[Test PNG API] Base64 생성: ${base64String.length} chars`);
        console.log(`[Test PNG API] PNG 버퍼 크기: ${pngBuffer.length} bytes`);
        
        return createSuccessResponse({
          success: true,
          format: 'base64',
          size: pngBuffer.length,
          base64Length: base64String.length,
          dataUrl: dataUrl,
          bufferValid: isPngBuffer(pngBuffer),
          message: 'PNG → Base64 변환 완료'
        });
      } else {
        // 바이너리로 직접 반환
        console.log(`[Test PNG API] 바이너리 PNG 반환: ${pngBuffer.length} bytes`);
        
        const response = new NextResponse(Buffer.from(pngBuffer));
        response.headers.set('Content-Type', 'image/png');
        response.headers.set('Content-Length', pngBuffer.length.toString());
        response.headers.set('Content-Disposition', 'inline; filename="test.png"');
        return response;
      }
    } else if (testType === 'roundtrip') {
      // Base64 왕복 테스트
      const originalBuffer = generateTestPng();
      console.log(`[Test PNG API] 원본 버퍼: ${originalBuffer.length} bytes`);
      
      // PNG → Base64
      const base64String = originalBuffer.toString('base64');
      console.log(`[Test PNG API] Base64 길이: ${base64String.length} chars`);
      
      // Base64 → PNG
      const decodedBuffer = Buffer.from(base64String, 'base64');
      console.log(`[Test PNG API] 디코딩 버퍼: ${decodedBuffer.length} bytes`);
      
      // 비교 검증
      const isIdentical = originalBuffer.equals(decodedBuffer);
      const originalValid = isPngBuffer(originalBuffer);
      const decodedValid = isPngBuffer(decodedBuffer);
      
      console.log(`[Test PNG API] 왕복 테스트 결과: identical=${isIdentical}, originalValid=${originalValid}, decodedValid=${decodedValid}`);
      
      return createSuccessResponse({
        success: true,
        test: 'roundtrip',
        originalSize: originalBuffer.length,
        base64Length: base64String.length,
        decodedSize: decodedBuffer.length,
        isIdentical: isIdentical,
        originalValid: originalValid,
        decodedValid: decodedValid,
        sampleBase64: base64String.substring(0, 100) + '...',
        message: `왕복 테스트 ${isIdentical ? '성공' : '실패'}`
      });
    }

    return createErrorResponse('Unknown test type');

  } catch (error) {
    console.error('[Test PNG API] 오류:', error);
    return createErrorResponse(`테스트 실패: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function generateTestPng(): Buffer {
  // 실제 유효한 PNG 생성 (100x100 파란색 사각형)
  const width = 100;
  const height = 100;
  
  // PNG 헤더와 최소 데이터로 유효한 PNG 생성
  // 실제 100x100 파란색 PNG (약 200바이트)
  const pngBase64 = `iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAYAAABw4pVUAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAJHSURBVHic7doxAQAACMOwgX+dNlNkWzsAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA7gN8dQC9JjEKgAAAAABJRU5ErkJggg==`;
  
  return Buffer.from(pngBase64, 'base64');
}

function isPngBuffer(buffer: Buffer): boolean {
  // PNG 파일 헤더 확인 (89 50 4E 47 0D 0A 1A 0A)
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  if (buffer.length < 8) {
    return false;
  }
  
  // 첫 8바이트가 PNG 시그니처와 일치하는지 확인
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) {
      return false;
    }
  }
  
  return true;
}

export async function OPTIONS() {
  return createOptionsResponse();
}
