'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, Copy, Calendar, ExternalLink, Filter, Grid, List, Trash2, Share2, Menu, X } from 'lucide-react';
import Link from 'next/link';

interface ArchiveItem {
    id: string;
    title: string;
    url: string;
    screenshot: string;
    tags: string[];
    createdAt: string;
    thumbnailUrl?: string;
}

export default function ArchivePage() {
    const [archives, setArchives] = useState<ArchiveItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTag, setSelectedTag] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [isLoading, setIsLoading] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        loadArchives();
    }, []);

    const loadArchives = async () => {
        try {
            const response = await fetch('/api/archive');
            if (response.ok) {
                const data = await response.json();
                setArchives(data.items || []);
            }
        } catch (error) {
            console.error('아카이브 로딩 실패:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = async (screenshot: string) => {
        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const response = await fetch(`data:image/png;base64,${screenshot}`);
                const blob = await response.blob();
                
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ]);
                
                alert('클립보드에 복사되었습니다!');
            } else {
                // 클립보드 API를 지원하지 않는 경우 다운로드로 대체
                downloadImage(screenshot, 'archive-image');
            }
        } catch (error) {
            console.error('클립보드 복사 실패:', error);
            // 실패 시 다운로드로 대체
            downloadImage(screenshot, 'archive-image');
        }
    };

    const downloadImage = (screenshot: string, filename: string) => {
        const link = document.createElement('a');
        link.href = `data:image/png;base64,${screenshot}`;
        link.download = `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const deleteArchive = async (id: string) => {
        if (confirm('이 아카이브를 삭제하시겠습니까?')) {
            try {
                const response = await fetch('/api/archive', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });

                if (response.ok) {
                    setArchives(prev => prev.filter(item => item.id !== id));
                }
            } catch (error) {
                console.error('삭제 실패:', error);
            }
        }
    };

    const filteredArchives = archives.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesTag = !selectedTag || item.tags.includes(selectedTag);
        
        return matchesSearch && matchesTag;
    });

    const allTags = [...new Set(archives.flatMap(item => item.tags))];

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0b0b16] flex items-center justify-center">
                <div className="text-white">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0b0b16] text-white">
            {/* Fixed Header */}
            <motion.div
                className="fixed top-0 left-0 right-0 bg-black/50 backdrop-blur-lg border-b border-white/10 z-50"
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6 }}
                style={{ height: '69px', zIndex: 9999 }}
            >
                <div className="flex items-center justify-between px-4 sm:px-6 h-full max-w-[calc(100%-2rem)] sm:max-w-[1280px] mx-auto">
                    <div className="flex items-center gap-14">
                        <Link
                            href="/"
                            className="text-[19.375px] font-bold text-white leading-7 hover:text-white/80 transition-colors cursor-pointer"
                            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                        >
                            ScreenFlow
                        </Link>
                        
                        {/* 데스크탑 네비게이션 메뉴 */}
                        <div className="hidden min-[500px]:flex items-center gap-6">
                            <Link
                                href="/archive"
                                className="text-sm text-white hover:text-white/80 transition-colors font-normal"
                                style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                            >
                                아카이브
                            </Link>
                            <span className="text-sm text-white hover:text-white/80 transition-colors font-normal cursor-pointer">
                                내 프로필
                            </span>
                        </div>
                    </div>
                    
                    {/* 데스크탑 인증 버튼 */}
                    <div className="hidden min-[500px]:flex items-center gap-4">
                        <button className="text-sm text-white/60 hover:text-white/80 font-normal transition-colors">
                            로그인
                        </button>
                        <button className="px-4 py-2 bg-white text-[#000000] rounded-lg text-sm font-bold hover:bg-white/90 transition-colors"
                            style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                        >
                            무료로 시작하기
                        </button>
                    </div>
                    
                    {/* 모바일 햄버거 메뉴 버튼 */}
                    <button 
                        className="min-[500px]:hidden p-2 text-white hover:text-white/80 transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        aria-label="메뉴 열기"
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </motion.div>
            
            {/* 모바일 드롭다운 메뉴 */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        className="fixed top-[69px] left-0 right-0 bg-black/95 backdrop-blur-lg border-b border-white/10 z-40 min-[500px]:hidden"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="px-4 py-6 space-y-4">
                            <Link 
                                href="/archive" 
                                className="block text-white hover:text-white/80 transition-colors font-normal text-center py-3"
                                style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                아카이브
                            </Link>
                            <div className="border-t border-white/10"></div>
                            <span 
                                className="block text-white hover:text-white/80 transition-colors font-normal cursor-pointer text-center py-3"
                                onClick={() => setIsMobileMenuOpen(false)}
                            >
                                내 프로필
                            </span>
                            <div className="border-t border-white/10"></div>
                            <div className="flex flex-col gap-3 pt-2">
                                <button 
                                    className="text-sm text-white/60 hover:text-white/80 font-normal text-center transition-colors"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    로그인
                                </button>
                                <button 
                                    className="w-full px-4 py-3 bg-white text-[#000000] rounded-lg text-sm font-bold hover:bg-white/90 transition-colors"
                                    style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    무료로 시작하기
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <div className="pt-[69px] px-4 sm:px-6 max-w-[calc(100%-2rem)] sm:max-w-7xl mx-auto">
                {/* Header Section */}
                <motion.div
                    className="mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <h1 className="text-[44px] font-bold leading-[48px] tracking-[-1.2px] mb-4"
                        style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                    >
                        아카이브
                    </h1>
                    <p className="text-white/50 text-[16px] leading-[28px]">
                        저장된 캡처 이력을 확인하고 관리하세요.
                    </p>
                </motion.div>

                {/* Search and Filter Section */}
                <motion.div
                    className="mb-8 bg-white/[0.019] rounded-2xl border border-white/[0.05] p-6"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.1 }}
                >
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                            <input
                                type="text"
                                placeholder="제목, URL, 태그로 검색..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[#1b1b1b] border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
                                style={{ fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
                            />
                        </div>

                        {/* Filter and View Mode */}
                        <div className="flex items-center gap-3">
                            {/* Tag Filter */}
                            <select
                                value={selectedTag}
                                onChange={(e) => setSelectedTag(e.target.value)}
                                className="bg-[#1b1b1b] border border-white/10 rounded-lg px-3 py-2 text-sm text-white appearance-none min-w-[120px]"
                            >
                                <option value="">모든 태그</option>
                                {allTags.map(tag => (
                                    <option key={tag} value={tag}>{tag}</option>
                                ))}
                            </select>

                            {/* View Mode Toggle */}
                            <div className="flex bg-[#1b1b1b] rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                >
                                    <Grid className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode('list')}
                                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-white/10' : 'hover:bg-white/5'}`}
                                >
                                    <List className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Archives Grid/List */}
                {filteredArchives.length === 0 ? (
                    <motion.div
                        className="text-center py-16"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="text-white/40 mb-4">저장된 아카이브가 없습니다.</div>
                        <Link href="/" className="text-blue-400 hover:text-blue-300 transition-colors">
                            캡처 시작하기 →
                        </Link>
                    </motion.div>
                ) : (
                    <motion.div
                        className={viewMode === 'grid' 
                            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
                            : "space-y-4"
                        }
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {filteredArchives.map((item, index) => (
                            <motion.div
                                key={item.id}
                                className={viewMode === 'grid' 
                                    ? "bg-white/[0.019] rounded-2xl border border-white/[0.05] overflow-hidden group hover:border-white/10 transition-all"
                                    : "bg-white/[0.019] rounded-2xl border border-white/[0.05] p-4 group hover:border-white/10 transition-all flex items-center gap-4"
                                }
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                            >
                                {viewMode === 'grid' ? (
                                    <>
                                        {/* Image */}
                                        <div className="aspect-[4/3] bg-black/10 relative overflow-hidden">
                                            <img
                                                src={`data:image/png;base64,${item.screenshot}`}
                                                alt={item.title}
                                                className="w-full h-full object-contain p-2"
                                            />
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="p-4">
                                            <h3 className="text-white font-medium text-sm mb-1 truncate" title={item.title}>
                                                {item.title}
                                            </h3>
                                            <p className="text-white/50 text-xs mb-3 truncate" title={item.url}>
                                                {item.url}
                                            </p>
                                            
                                            {/* Tags */}
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {item.tags.slice(0, 2).map(tag => (
                                                    <span key={tag} className="bg-purple-900/30 text-purple-300 px-2 py-1 rounded text-xs">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                            
                                            {/* Date */}
                                            <div className="flex items-center gap-1 text-white/40 text-xs mb-3">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                                            </div>
                                            
                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => copyToClipboard(item.screenshot)}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 rounded px-3 py-2 text-xs flex items-center justify-center gap-1 transition-colors"
                                                    title="클립보드 복사"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => downloadImage(item.screenshot, item.title)}
                                                    className="flex-1 bg-white/5 hover:bg-white/10 rounded px-3 py-2 text-xs flex items-center justify-center gap-1 transition-colors"
                                                    title="다운로드"
                                                >
                                                    <Download className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => deleteArchive(item.id)}
                                                    className="bg-red-900/30 hover:bg-red-900/50 rounded px-3 py-2 text-xs flex items-center justify-center transition-colors"
                                                    title="삭제"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* List View */}
                                        <img
                                            src={`data:image/png;base64,${item.screenshot}`}
                                            alt={item.title}
                                            className="w-16 h-12 object-contain rounded"
                                        />
                                        <div className="flex-1">
                                            <h3 className="text-white font-medium text-sm mb-1" title={item.title}>
                                                {item.title}
                                            </h3>
                                            <p className="text-white/50 text-xs mb-2" title={item.url}>
                                                {item.url}
                                            </p>
                                            <div className="flex items-center gap-2 text-white/40 text-xs">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(item.createdAt).toLocaleDateString('ko-KR')}
                                                <span className="ml-2">
                                                    {item.tags.map(tag => `#${tag}`).join(' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => copyToClipboard(item.screenshot)}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                                title="클립보드 복사"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => downloadImage(item.screenshot, item.title)}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                                title="다운로드"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteArchive(item.id)}
                                                className="p-2 bg-red-900/30 hover:bg-red-900/50 rounded transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </div>
        </div>
    );
}