import { useState, useCallback } from 'react';
import { useSettings } from '../contexts/SettingsContext.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx';
// import { useApiKeys } from '../contexts/ApiKeysContext.tsx'; // No longer needed
import * as geminiService from '../../services/geminiService.ts';
import { CardData, NewsArticle, NewsArticleCore, CardDisplayState, getCountryName, SelectedLanguageCode, HeaderType } from '../../types.ts';
import html2canvas from 'html2canvas';
import JSZip from 'jszip';
import { useFacebookPage } from '../contexts/FacebookPageContext.tsx';

const API_VERSION = 'v19.0';

/**
 * A helper function to capture an HTML element and trigger a download.
 * It uses a temporary scaling technique to increase the output resolution significantly.
 * @param element The HTML element to capture.
 * @param fileName The base name for the downloaded file.
 * @param addNotification A function to show user notifications.
 */
const captureAndDownload = async (
    element: HTMLElement,
    fileName: string,
    addNotification: (message: string, type: 'success' | 'error' | 'info') => void
) => {
    try {
        const canvas = await html2canvas(element, {
            allowTaint: true,
            useCORS: true,
            scale: 7,
            backgroundColor: null,
            ignoreElements: (node) => {
                return (node as HTMLElement).classList?.contains('no-screenshot');
            },
        });

        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);

        const link = document.createElement('a');
        link.download = `${fileName.slice(0, 50).replace(/[^a-z0-9]/gi, '_')}.jpeg`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e: any) {
        console.error("Download failed:", e);
        addNotification(`Download failed: ${e.message || 'Unknown error'}. See console.`, 'error');
    }
};


export const useContentManager = (
    setCropRequest: (request: { file: File; articleId: string } | null) => void
) => {
    const { settings } = useSettings();
    const { addNotification } = useNotification();
    const { activePage } = useFacebookPage();

    const [cards, setCards] = useState<CardData[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isPreparingArticles, setIsPreparingArticles] = useState<boolean>(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);
    const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);


    const updateCardState = useCallback((id: string, updates: Partial<CardData>) => {
        setCards(prevCards =>
            prevCards.map(card => card.id === id ? { ...card, ...updates } as CardData : card)
        );
    }, []);

    const addCard = useCallback((card: CardData) => {
        setCards(prev => [...prev, card]);
    }, []);

    const handleGenerateContent = useCallback(async (customPrompt?: string) => {
        setIsLoading(true);
        setIsPreparingArticles(true);

        try {
            const { postCount, selectedLanguage, selectedCountryCode, selectedEmotion, selectedContentType, selectedContentCategory, ...defaultStyles } = settings;
            const countryName = getCountryName(selectedCountryCode);
            
            const fetchedData = customPrompt
                ? await geminiService.fetchContentFromPrompt(customPrompt, postCount, selectedLanguage, selectedCountryCode, countryName, selectedEmotion)
                : await geminiService.fetchContent(postCount, selectedContentType, selectedContentCategory, selectedLanguage, selectedCountryCode, countryName, selectedEmotion);
            
            const { articles: fetchedArticlesCore, sourcesByHeadline } = fetchedData;

            if (!fetchedArticlesCore || fetchedArticlesCore.length === 0) {
                addNotification(customPrompt ? "I couldn't generate content for that prompt." : "AI returned no content.", "info");
                return;
            }

            setIsLoading(false); // Stop main loader, individual card loaders will show

            // Process one card at a time from start to finish
            for (const [index, core] of fetchedArticlesCore.entries()) {
                const newArticle: (NewsArticle & { type: 'news' }) = {
                    ...core,
                    type: 'news',
                    id: `${Date.now()}-${index}`,
                    sources: sourcesByHeadline[core.long_headline] || [],
                    isHighlighting: true,
                    style: { ...defaultStyles },
                    localImageUrl: null,
                    objectAiImageQuery: null,
                    isObjectAiImageQueryReady: false,
                    objectAiImageUrl: null,
                    isObjectAiImageLoading: false,
                    objectAiImageError: null,
                    aiImageUrl: null,
                    isAiImageLoading: true,
                    aiImageError: null,
                    displayState: CardDisplayState.AI_IMAGE_LOADING,
                };
                
                // Add the card to the UI in its loading state
                addCard(newArticle);

                // Generate highlighted headline
                try {
                    const html = await geminiService.getHighlightedHeadlineHtml(newArticle.long_headline, selectedLanguage, newArticle.style.headlineHighlightColors);
                    updateCardState(newArticle.id, { highlighted_headline_html: html, isHighlighting: false });
                } catch (e) {
                    console.warn(`Highlighting failed for "${newArticle.long_headline}"`, e);
                    updateCardState(newArticle.id, { isHighlighting: false });
                }
                
                // Generate AI image
                try {
                    // This await pauses the loop until the image is generated, creating a sequential process.
                    const imageUrl = await geminiService.generateAiArticleImage(newArticle.long_headline, settings.selectedLanguage);
                    updateCardState(newArticle.id, { aiImageUrl: imageUrl, isAiImageLoading: false, displayState: CardDisplayState.AI_IMAGE_LOADED });
                } catch (e: any) {
                    const errorMessage = e.message || "Unknown error generating image.";

                    if (errorMessage.toLowerCase().includes("rate limit exceeded")) {
                        addNotification("API rate limit hit. Pausing for 60 seconds before retrying...", "info", 60000);
                        await new Promise(resolve => setTimeout(resolve, 60000));
                        addNotification(`Resuming image generation for "${newArticle.long_headline.substring(0, 20)}..."`, "info");
                        
                        // Retry the current image generation once
                        try {
                            const imageUrl = await geminiService.generateAiArticleImage(newArticle.long_headline, settings.selectedLanguage);
                            updateCardState(newArticle.id, { aiImageUrl: imageUrl, isAiImageLoading: false, displayState: CardDisplayState.AI_IMAGE_LOADED });
                        } catch (retryError: any) {
                            const retryErrorMessage = retryError.message || "Unknown error on retry.";
                            updateCardState(newArticle.id, { isAiImageLoading: false, aiImageError: retryErrorMessage, displayState: CardDisplayState.AI_IMAGE_FAILED });
                            addNotification(`Image for "${newArticle.long_headline.substring(0, 20)}..." failed on retry: ${retryErrorMessage}`, "error");
                        }
                    } else {
                        updateCardState(newArticle.id, { isAiImageLoading: false, aiImageError: errorMessage, displayState: CardDisplayState.AI_IMAGE_FAILED });
                        addNotification(`Image for "${newArticle.long_headline.substring(0, 20)}..." failed: ${errorMessage}`, "error");
                    }
                }
            }
        } catch (e: any) {
            addNotification(e.message || "Failed to generate content.", "error");
        } finally {
            setIsLoading(false);
            setIsPreparingArticles(false);
        }
    }, [settings, addNotification, updateCardState, addCard]);

    const handleGenerateViralPost = useCallback(async (topic: string) => {
        const newPostId = `${Date.now()}-viral`;
        addCard({
            type: 'viral', id: newPostId, topic, headline: 'Generating...',
            summary: `Creating a viral post for "${topic}"`, imageUrl: null,
            isLoading: true, error: null,
        });

        try {
            const content = await geminiService.generateViralPostContent(topic);
            updateCardState(newPostId, { headline: content.headline, summary: content.summary });
            const imageUrl = await geminiService.generateViralImage(content.image_prompt);
            updateCardState(newPostId, { imageUrl, isLoading: false });
            addNotification(`Viral post for "${topic}" generated!`, 'success');
        } catch (e: any) {
            updateCardState(newPostId, { error: e.message || "Failed to generate viral post.", isLoading: false });
            addNotification(`Failed on "${topic}": ${e.message}`, "error");
        }
    }, [addCard, updateCardState, addNotification]);

    const fileToBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    const [header, base64data] = reader.result.split(',');
                    const mimeType = header.match(/:(.*?);/)?.[1] || file.type;
                    resolve({ mimeType, data: base64data });
                } else {
                    reject(new Error('Failed to read file as data URL.'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const handleRecreateFromImage = useCallback(async (file: File, customCaption?: string) => {
        setIsLoading(true);
        addNotification('Analyzing image to recreate post...', 'info');
        try {
            const imageData = await fileToBase64(file);
            const content = await geminiService.analyzeAndGenerateViralContent(imageData, customCaption);
            
            const { postCount, selectedLanguage, selectedCountryCode, selectedEmotion, selectedContentType, selectedContentCategory, ...defaultStyles } = settings;

            const newArticle: (NewsArticle & { type: 'news' }) = {
                long_headline: content.headline,
                summary: content.summary,
                type: 'news',
                id: `${Date.now()}-recreated`,
                sources: [],
                isHighlighting: false,
                style: { 
                    ...defaultStyles,
                    headerType: HeaderType.Solid,
                    selectedHeaderColor: '#FFFF00', // Yellow
                    headlineFontFamily: "Boogaloo, cursive",
                    headlineTextSize: 40, // Reduced from 52 for better auto-fitting
                    headlineTextAlign: 'center',
                    headlineFontWeight: 'bold',
                    summaryBackgroundColor: 'rgba(0, 0, 0, 0.5)',
                    summaryTextColor: '#FFFFFF',
                    headlineHighlightColors: [],
                    showSummary: !!content.summary, // Only show summary if AI found text for it
                 },
                localImageUrl: null,
                objectAiImageQuery: null,
                isObjectAiImageQueryReady: false,
                objectAiImageUrl: null,
                isObjectAiImageLoading: false,
                objectAiImageError: null,
                aiImageUrl: null,
                isAiImageLoading: true,
                aiImageError: null,
                displayState: CardDisplayState.AI_IMAGE_LOADING,
            };

            addCard(newArticle);
            addNotification('Post structure analyzed. Now generating new image...', 'info');
            setIsLoading(false);

            const imageUrl = await geminiService.generateAiArticleImage(content.image_prompt, settings.selectedLanguage);
            updateCardState(newArticle.id, { aiImageUrl: imageUrl, isAiImageLoading: false, displayState: CardDisplayState.AI_IMAGE_LOADED });
            addNotification('New viral-style post created!', 'success');

        } catch (e: any) {
            addNotification(e.message || "Failed to recreate post from image.", "error");
            setIsLoading(false);
        }

    }, [settings, addNotification, updateCardState, addCard]);

    const handleClearAllContent = useCallback(() => setCards([]), []);

    const handleGenerateAiImageForCard = useCallback(async (articleId: string) => {
        const card = cards.find(c => c.id === articleId);
        if (card?.type !== 'news') return;
        
        updateCardState(articleId, { isAiImageLoading: true, aiImageError: null, displayState: CardDisplayState.AI_IMAGE_LOADING });
        try {
            const imageUrl = await geminiService.generateAiArticleImage(card.long_headline, settings.selectedLanguage);
            updateCardState(articleId, { aiImageUrl: imageUrl, isAiImageLoading: false, displayState: CardDisplayState.AI_IMAGE_LOADED, localImageUrl: null });
        } catch (e: any) {
            updateCardState(articleId, { isAiImageLoading: false, aiImageError: e.message, displayState: CardDisplayState.AI_IMAGE_FAILED });
            addNotification(e.message, "error");
        }
    }, [cards, settings.selectedLanguage, updateCardState, addNotification]);

    const handleLocalImageUpload = useCallback((articleId: string, file: File) => {
        setCropRequest({ file, articleId });
    }, [setCropRequest]);

    const handleCropConfirm = useCallback((articleId: string, croppedDataUrl: string) => {
        updateCardState(articleId, { localImageUrl: croppedDataUrl });
    }, [updateCardState]);
    
    const handleUpdateTextAndRegenerate = useCallback(async (
        articleId: string,
        updates: { headline: string; summary: string; wordCount?: number }
    ) => {
        const card = cards.find(c => c.id === articleId);
        if (card?.type !== 'news') return;

        updateCardState(articleId, { summary: updates.summary });

        let finalHeadline = updates.headline;
        if (updates.wordCount && updates.wordCount > 0) {
            updateCardState(articleId, { isHighlighting: true });
            try {
                finalHeadline = await geminiService.regenerateHeadlineByWordCount(updates.headline, updates.wordCount, settings.selectedLanguage);
            } catch(e) { /* ignore, use original */ }
        }
        updateCardState(articleId, { long_headline: finalHeadline, isHighlighting: true });

        try {
            const html = await geminiService.getHighlightedHeadlineHtml(finalHeadline, settings.selectedLanguage, card.style.headlineHighlightColors);
            updateCardState(articleId, { highlighted_headline_html: html, isHighlighting: false });
        } catch(e) {
            updateCardState(articleId, { isHighlighting: false });
        }

    }, [cards, updateCardState, settings.selectedLanguage]);

    const handleRegenerateAllHeadlines = useCallback(async (wordCount: number) => {
        if (wordCount <= 0) return;
        addNotification(`Regenerating all headlines to be ${wordCount} words...`, 'info');
        const newsCards = cards.filter(c => c.type === 'news') as NewsArticle[];

        for (const card of newsCards) {
             updateCardState(card.id, { isHighlighting: true });
             try {
                const newHeadline = await geminiService.regenerateHeadlineByWordCount(card.long_headline, wordCount, settings.selectedLanguage);
                updateCardState(card.id, { long_headline: newHeadline });
                const html = await geminiService.getHighlightedHeadlineHtml(newHeadline, settings.selectedLanguage, card.style.headlineHighlightColors);
                updateCardState(card.id, { highlighted_headline_html: html, isHighlighting: false });
             } catch(e) {
                 updateCardState(card.id, { isHighlighting: false });
             }
        }
        addNotification('Finished regenerating all headlines.', 'success');
    }, [cards, settings.selectedLanguage, updateCardState, addNotification]);

    const handleDownloadCard = useCallback((cardElement: HTMLElement, article: NewsArticle) => {
        captureAndDownload(cardElement, article.long_headline, addNotification);
    }, [addNotification]);
    
    const handleDownloadViralPost = useCallback((cardElement: HTMLElement, title: string) => {
        captureAndDownload(cardElement, title, addNotification);
    }, [addNotification]);

    const handleDownloadAll = useCallback(async () => {
        const visibleCards = Array.from(document.querySelectorAll('.news-card-wrapper, .viral-post-card-container'));
        if (visibleCards.length === 0) return;
    
        setIsDownloadingAll(true);
        addNotification(`Starting download of ${visibleCards.length} cards...`, 'info');
    
        const zip = new JSZip();
        for (let i = 0; i < visibleCards.length; i++) {
            const element = visibleCards[i] as HTMLElement;
            const cardId = element.closest('[data-card-id]')?.getAttribute('data-card-id');
            const cardData = cards.find(c => c.id === cardId);
            const title = cardData ? (cardData.type === 'news' ? cardData.long_headline : cardData.topic) : `card-${i+1}`;
            
            try {
                const canvas = await html2canvas(element, { allowTaint: true, useCORS: true, scale: 7, backgroundColor: null, ignoreElements: (node) => (node as HTMLElement).classList.contains('no-screenshot') });
                const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                const fileName = `${title.slice(0, 50).replace(/[^a-z0-9]/gi, '_')}.jpeg`;
                zip.file(fileName, dataUrl.split(',')[1], { base64: true });
            } catch(e: any) {
                addNotification(`Skipping card "${title.slice(0,20)}...": ${e.message}`, 'error');
            }
        }
    
        try {
            const content = await zip.generateAsync({ type: "blob" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(content);
            link.download = `content_cards_${Date.now()}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch(e: any) {
            addNotification(`Error creating ZIP file: ${e.message}`, 'error');
        } finally {
            setIsDownloadingAll(false);
        }
    }, [cards, addNotification]);

    const handlePostCardToFacebook = useCallback(async (cardId: string) => {
        if (!activePage) {
            addNotification('No Facebook Page selected. Please connect a page in the header.', 'error');
            return;
        }
        const card = cards.find(c => c.id === cardId);
        if (!card) {
            addNotification('Card not found.', 'error');
            return;
        }

        setUploadingCardId(cardId);
        try {
            const cardElement = document.querySelector(`[data-card-id='${cardId}'] .news-card-wrapper, [data-card-id='${cardId}'] .viral-post-card-container`);
            if (!cardElement) {
                throw new Error('Could not find card element to capture.');
            }
            const canvas = await html2canvas(cardElement as HTMLElement, {
                allowTaint: true, useCORS: true, scale: 7, backgroundColor: null, 
                ignoreElements: (node) => (node as HTMLElement).classList.contains('no-screenshot'),
            });

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 1.0));
            if (!blob) throw new Error('Failed to create image from card.');

            const originalCaption = card.type === 'news' ? card.long_headline : (card.headline || card.topic);
            addNotification('Generating AI caption for Facebook...', 'info');
            
            // Generate a more descriptive caption suitable for cross-posting
            const caption = await geminiService.generateCrossPostCaption(originalCaption, settings.selectedLanguage as SelectedLanguageCode);
            
            const formData = new FormData();
            formData.append('access_token', activePage.access_token);
            formData.append('caption', caption);
            formData.append('source', blob, 'post.jpg');

            const response = await fetch(`https://graph.facebook.com/${API_VERSION}/${activePage.id}/photos`, {
                method: 'POST',
                body: formData,
            });
            const responseData = await response.json();

            if (responseData.error) throw new Error(`Facebook API Error: ${responseData.error.message}`);
            
            addNotification('Successfully posted to Facebook!', 'success');

        } catch (e: any) {
            console.error("Failed to post to Facebook:", e);
            addNotification(`Post failed: ${e.message}`, 'error');
        } finally {
            setUploadingCardId(null);
        }
    }, [activePage, cards, addNotification, settings.selectedLanguage]);

    return {
        cards,
        setCards,
        isLoading,
        isPreparingArticles,
        isDownloadingAll,
        uploadingCardId,
        handleGenerateContent,
        handleGenerateViralPost,
        handleRecreateFromImage,
        handleClearAllContent,
        handleGenerateAiImageForCard,
        handleLocalImageUpload,
        handleCropConfirm,
        handleUpdateTextAndRegenerate,
        handleRegenerateAllHeadlines,
        handleDownloadCard,
        handleDownloadViralPost,
        handleDownloadAll,
        handlePostCardToFacebook
    };
};
