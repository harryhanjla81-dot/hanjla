import React from 'react';
import NewsCard from '../../../components/NewsCard.tsx';
import ViralPostCard from '../../../components/ViralPostCard.tsx';
import Spinner from '../../../components/Spinner.tsx';
import { CardData, NewsArticle } from '../../../types.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';

interface CardGridProps {
    cards: CardData[];
    isLoading: boolean;
    editingCardId: string | null;
    isEditingAll: boolean;
    uploadingCardId: string | null;
    onDownloadCard: (el: HTMLElement, article: NewsArticle) => void;
    onGenerateAiImage: (id: string) => void;
    onUploadImage: (id: string, file: File) => void;
    onEditCard: (id: string) => void;
    onDownloadViralPost: (el: HTMLElement, title: string) => void;
    onPostToFacebook: (id: string) => void;
}

const CardGrid: React.FC<CardGridProps> = ({
    cards,
    isLoading,
    editingCardId,
    isEditingAll,
    uploadingCardId,
    onDownloadCard,
    onGenerateAiImage,
    onUploadImage,
    onEditCard,
    onDownloadViralPost,
    onPostToFacebook,
}) => {
    const { user } = useAuth();

    if (cards.length === 0 && !isLoading) {
        return (
            <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg shadow-md">
                <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Welcome!</h2>
                <p className="mt-2 text-gray-500 dark:text-gray-400">Use the prompt bar or click a "Generate" button to create content.</p>
            </div>
        );
    }

    if (isLoading && cards.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-20 min-h-[60vh]">
                {/* Water Drop Loader */}
                <div className="relative flex justify-center items-center w-24 h-24 mb-8">
                    <div className="absolute w-6 h-6 bg-blue-400 rounded-full animate-[water-drop-pulse_1.5s_ease-in-out_infinite]"></div>
                    <div className="absolute w-6 h-6 bg-blue-400 rounded-full animate-[water-drop-pulse_1.5s_ease-in-out_infinite] animation-delay-200"></div>
                    <div className="absolute w-6 h-6 bg-blue-400 rounded-full animate-[water-drop-pulse_1.5s_ease-in-out_infinite] animation-delay-400"></div>
                </div>
                
                {/* Personalized Welcome Message */}
                <h2 
                    className="font-teko text-5xl md:text-7xl font-bold text-gray-800 dark:text-gray-100 animate-[text-glow_3s_ease-in-out_infinite]"
                    style={{ letterSpacing: '0.05em' }}
                >
                    Hi! {user?.displayName || 'User'}
                </h2>
                <p className="mt-2 text-lg text-gray-500 dark:text-gray-400">
                    Thank You For Coming Here
                </p>
                <p className="mt-4 text-gray-600 dark:text-gray-300">
                    Generating initial content, please wait...
                </p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
                <div key={card.id} data-card-id={card.id}>
                    {card.type === 'news' ? (
                        <NewsCard
                            article={card}
                            onDownload={onDownloadCard}
                            onGenerateAiImage={onGenerateAiImage}
                            onUploadImage={onUploadImage}
                            onEdit={onEditCard}
                            editingCardId={editingCardId}
                            isEditingAll={isEditingAll}
                            onUploadPost={onPostToFacebook}
                            isUploading={uploadingCardId === card.id}
                        />
                    ) : (
                        <ViralPostCard
                            post={card}
                            onDownload={onDownloadViralPost}
                            onUploadPost={onPostToFacebook}
                            isUploading={uploadingCardId === card.id}
                        />
                    )}
                </div>
            ))}
        </div>
    );
};

export default CardGrid;