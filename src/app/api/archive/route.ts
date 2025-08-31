import { NextRequest, NextResponse } from 'next/server';

interface ArchiveItem {
  id: string;
  url: string;
  title: string;
  screenshot: string; // base64
  tags: string[];
  createdAt: string;
  category?: string;
  notes?: string;
}

// 간단한 인메모리 저장소 (실제로는 DB 사용)
let archiveStore: ArchiveItem[] = [];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const category = searchParams.get('category');

    let filteredItems = archiveStore;

    if (tag) {
      filteredItems = filteredItems.filter(item => 
        item.tags.some(t => t.toLowerCase().includes(tag.toLowerCase()))
      );
    }

    if (category) {
      filteredItems = filteredItems.filter(item => 
        item.category?.toLowerCase() === category.toLowerCase()
      );
    }

    return NextResponse.json({
      success: true,
      items: filteredItems.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      total: filteredItems.length,
      allTags: [...new Set(archiveStore.flatMap(item => item.tags))].sort()
    });

  } catch (error) {
    console.error('[Archive GET] 오류:', error);
    return NextResponse.json({
      error: '아카이브 조회 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Archive POST] 새 아이템 추가');
    
    const body = await request.json();
    const { url, title, screenshot, tags = [], category, notes } = body;

    if (!url || !title || !screenshot) {
      return NextResponse.json({ 
        error: 'url, title, screenshot이 필요합니다.' 
      }, { status: 400 });
    }

    const newItem: ArchiveItem = {
      id: `archive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      title,
      screenshot,
      tags: Array.isArray(tags) ? tags : [],
      category,
      notes,
      createdAt: new Date().toISOString()
    };

    archiveStore.push(newItem);

    console.log(`[Archive POST] 추가됨: ${title} (태그: ${tags.join(', ')})`);

    return NextResponse.json({
      success: true,
      item: newItem,
      message: '아카이브에 추가되었습니다.'
    });

  } catch (error) {
    console.error('[Archive POST] 오류:', error);
    return NextResponse.json({
      error: '아카이브 추가 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    console.log('[Archive PUT] 아이템 업데이트');
    
    const body = await request.json();
    const { id, tags, category, notes } = body;

    if (!id) {
      return NextResponse.json({ 
        error: 'id가 필요합니다.' 
      }, { status: 400 });
    }

    const itemIndex = archiveStore.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return NextResponse.json({ 
        error: '아이템을 찾을 수 없습니다.' 
      }, { status: 404 });
    }

    // 업데이트
    if (tags !== undefined) archiveStore[itemIndex].tags = tags;
    if (category !== undefined) archiveStore[itemIndex].category = category;
    if (notes !== undefined) archiveStore[itemIndex].notes = notes;

    console.log(`[Archive PUT] 업데이트됨: ${archiveStore[itemIndex].title}`);

    return NextResponse.json({
      success: true,
      item: archiveStore[itemIndex],
      message: '아카이브가 업데이트되었습니다.'
    });

  } catch (error) {
    console.error('[Archive PUT] 오류:', error);
    return NextResponse.json({
      error: '아카이브 업데이트 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // URL 파라미터와 Body 둘 다 지원
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');
    
    // URL 파라미터에 없으면 body에서 확인
    if (!id) {
      try {
        const body = await request.json();
        id = body.id;
      } catch (error) {
        // body 파싱 실패 시 무시
      }
    }

    if (!id) {
      return NextResponse.json({ 
        error: 'id가 필요합니다.' 
      }, { status: 400 });
    }

    const itemIndex = archiveStore.findIndex(item => item.id === id);
    if (itemIndex === -1) {
      return NextResponse.json({ 
        error: '아이템을 찾을 수 없습니다.' 
      }, { status: 404 });
    }

    const deletedItem = archiveStore.splice(itemIndex, 1)[0];

    console.log(`[Archive DELETE] 삭제됨: ${deletedItem.title}`);

    return NextResponse.json({
      success: true,
      message: '아카이브에서 삭제되었습니다.'
    });

  } catch (error) {
    console.error('[Archive DELETE] 오류:', error);
    return NextResponse.json({
      error: '아카이브 삭제 중 오류가 발생했습니다.',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
