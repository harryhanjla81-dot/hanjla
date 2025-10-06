import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import Spinner from './components/Spinner.tsx';
import * as geminiService from './services/geminiService.ts';
import { useNotification } from './src/contexts/NotificationContext.tsx';
import SchedulerTab from './components/SchedulerTab.tsx';
import { FBPage, SelectedLanguageCode } from './types.ts';
import { useFacebookPage } from './src/contexts/FacebookPageContext.tsx';
import FacebookLoginPrompt from './components/FacebookLoginPrompt.tsx';
// import { useApiKeys } from './src/contexts/ApiKeysContext.tsx'; // No longer needed

// --- CONSTANTS ---
const API_VERSION = 'v19.0';

// --- TYPE DEFINITIONS ---
interface SchedulerSettings {
    files: File[];
    postType: 'Image' | 'Video';
    startDate: string;
    interval: number; // in minutes
    startTime: string;
    endTime: string;
    demoCaption: string;
    captionMode: 'demo' | 'filename' | 'image_analysis';
    captionLanguage: SelectedLanguageCode;
    checkInPlaceId: string;
    smartScheduleEnabled: boolean;
}

interface SchedulingLogEntry {
    timestamp: string;
    file: string;
    status: 'success' | 'error' | 'info';
    message: string;
}


// --- MAIN COMPONENT ---
const UploaderPage: React.FC = () => {
    const { addNotification } = useNotification();
    const { isAuthenticated, activePage, logout } = useFacebookPage();
    
    // Scheduler State
    const [schedulerSettings, setSchedulerSettings] = useState<SchedulerSettings>({
        files: [],
        postType: 'Image',
        startDate: new Date().toISOString().split('T')[0],
        interval: 60,
        startTime: '09:00',
        endTime: '22:00',
        demoCaption: 'Check out this amazing picture! #awesome #picoftheday',
        captionMode: 'demo',
        captionLanguage: 'en',
        checkInPlaceId: '',
        smartScheduleEnabled: false,
    });
    const [isScheduling, setIsScheduling] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(isPaused);
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    const [isTesting, setIsTesting] = useState(false);
    const [schedulingProgress, setSchedulingProgress] = useState({ current: 0, total: 0 });
    const [schedulingLog, setSchedulingLog] = useState<SchedulingLogEntry[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const schedulerCancelToken = useRef({ cancelled: false });

    const addLog = useCallback((entry: Omit<SchedulingLogEntry, 'timestamp'>) => {
        const timestamp = new Date().toLocaleTimeString();
        setSchedulingLog(prev => [{ ...entry, timestamp }, ...prev]);
    }, []);

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Scroll log to bottom
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = 0;
        }
    }, [schedulingLog]);

    const handleSettingChange = (key: keyof SchedulerSettings, value: any) => {
        setSchedulerSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);
            handleSettingChange('files', selectedFiles);
            addLog({ file: '', status: 'info', message: `${selectedFiles.length} files selected.` });
        }
    }, [addLog]);

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

    const uploadPost = useCallback(async (file: File, scheduleTime: Date | null) => {
        if (!activePage) throw new Error("No active page selected.");
        
        let caption = '';
        if (schedulerSettings.captionMode === 'image_analysis') {
            addLog({ file: file.name, status: 'info', message: 'Analyzing image to generate AI caption...' });
            try {
                const imageData = await fileToBase64(file);
                // FIX: Removed apiKey argument. The service handles the key.
                caption = await geminiService.generateCaptionFromImage(imageData, schedulerSettings.captionLanguage);
            } catch (e: any) {
                throw new Error(`AI caption generation from image failed: ${e.message}`);
            }
        } else {
            addLog({ file: file.name, status: 'info', message: 'Generating AI caption from text...' });
            const sourceText = schedulerSettings.captionMode === 'demo' ? schedulerSettings.demoCaption : file.name;
            // FIX: Removed apiKey argument. The service handles the key.
            caption = await geminiService.generateCaptionFromText(sourceText, schedulerSettings.captionMode as 'demo' | 'filename');
        }
        addLog({ file: file.name, status: 'info', message: `Caption ready: "${caption.substring(0, 50)}..."` });

        // --- Step 1: Upload media without publishing ---
        addLog({ file: file.name, status: 'info', message: 'Uploading media file to Facebook...' });
        const mediaFormData = new FormData();
        mediaFormData.append('access_token', activePage.access_token);
        mediaFormData.append('source', file);
        mediaFormData.append('published', 'false'); // Upload but don't create a post yet

        const mediaEndpoint = schedulerSettings.postType === 'Image' ? 'photos' : 'videos';
        const mediaUploadResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${activePage.id}/${mediaEndpoint}`, {
            method: 'POST',
            body: mediaFormData,
        });
        const mediaUploadData = await mediaUploadResponse.json();

        if (mediaUploadData.error) {
            throw new Error(`Media upload failed: ${mediaUploadData.error.message}`);
        }

        const mediaId = mediaUploadData.id;
        if (!mediaId) {
            throw new Error('Media uploaded, but did not receive a media ID from Facebook.');
        }
        addLog({ file: file.name, status: 'info', message: `Media uploaded successfully. ID: ${mediaId}. Now creating post...` });

        // --- Step 2: Create the feed post with the media and place ID ---
        const postFormData = new FormData();
        postFormData.append('access_token', activePage.access_token);
        postFormData.append('message', caption);
        postFormData.append('attached_media[0]', JSON.stringify({ media_fbid: mediaId }));

        if (schedulerSettings.checkInPlaceId) {
            addLog({ file: file.name, status: 'info', message: `Attaching place with ID: ${schedulerSettings.checkInPlaceId}.` });
            postFormData.append('place', schedulerSettings.checkInPlaceId);
        }
        
        if (scheduleTime) {
            postFormData.append('published', 'false');
            postFormData.append('scheduled_publish_time', Math.floor(scheduleTime.getTime() / 1000).toString());
            addLog({ file: file.name, status: 'info', message: `Scheduling post for ${scheduleTime.toLocaleString()}` });
        } else {
            addLog({ file: file.name, status: 'info', message: `Publishing post immediately...` });
        }

        const postResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${activePage.id}/feed`, {
            method: 'POST',
            body: postFormData,
        });
        const postResponseData = await postResponse.json();

        if (postResponseData.error) {
            throw new Error(`Post creation failed: ${postResponseData.error.message}`);
        }
        
        const successMessage = scheduleTime
            ? `Scheduled successfully! Post ID: ${postResponseData.id}`
            : `Posted successfully! Post ID: ${postResponseData.id}`;
        addLog({ file: file.name, status: 'success', message: successMessage });

    }, [activePage, addLog, schedulerSettings]);


    const handleTestUpload = useCallback(async () => {
        if (isScheduling || isTesting) return;
        if (schedulerSettings.files.length === 0) {
            addLog({ file: '', status: 'error', message: 'No file selected to test.' });
            addNotification('No file selected to test.', 'error');
            return;
        }

        setIsTesting(true);
        addLog({ file: '', status: 'info', message: `Starting test upload of ${schedulerSettings.files[0].name}...` });
        
        try {
            await uploadPost(schedulerSettings.files[0], null);
            addNotification(`Test post "${schedulerSettings.files[0].name}" uploaded successfully.`, 'success');
        } catch (e: any) {
            const message = (e.message || '').toLowerCase();
            if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                addNotification('Facebook token expired. Please log in again.', 'error');
                logout();
            } else {
                addLog({ file: schedulerSettings.files[0].name, status: 'error', message: `Test failed: ${e.message}` });
                addNotification(`Test upload failed: ${e.message}`, 'error');
            }
        } finally {
            setIsTesting(false);
        }
    }, [isScheduling, isTesting, schedulerSettings.files, addLog, uploadPost, addNotification, logout]);
    
    // --- Smart Schedule Helpers ---
    const fetchPageInsights = async (page: FBPage): Promise<number[]> => {
        addLog({ file: '', status: 'info', message: `Analyzing page engagement... (mock data). This requires 'read_insights' permission.` });
        return [100, 80, 70, 60, 50, 60, 80, 120, 150, 200, 250, 300, 320, 310, 280, 260, 300, 350, 450, 500, 520, 480, 400, 250];
    };

    const getSmartSchedule = async (page: FBPage, numberOfPosts: number): Promise<Date[]> => {
        const insights = await fetchPageInsights(page);
        
        const hoursWithFollowers = insights.map((followers, hour) => ({ hour, followers }));
        hoursWithFollowers.sort((a, b) => b.followers - a.followers);

        const scheduleDates: Date[] = [];
        let currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + 1);

        for (let i = 0; i < numberOfPosts; i++) {
            const bestHourData = hoursWithFollowers[i % 5];
            
            if (i > 0 && i % 3 === 0) {
                 currentDate.setDate(currentDate.getDate() + 1);
            }

            const postDate = new Date(currentDate);
            const randomMinute = Math.floor(Math.random() * 60);
            postDate.setHours(bestHourData.hour, randomMinute, 0, 0);

            if (postDate.getTime() < Date.now() + 600000) {
                 postDate.setDate(postDate.getDate() + 1);
            }

            scheduleDates.push(postDate);
        }
        
        scheduleDates.sort((a, b) => a.getTime() - b.getTime());
        return scheduleDates;
    };


    // Handle the actual scheduling process
    const handleSchedulingProcess = useCallback(async () => {
        if (isScheduling) {
            schedulerCancelToken.current.cancelled = true;
            addLog({ file: '', status: 'info', message: 'Stopping scheduling process...' });
            return;
        }
        if (schedulerSettings.files.length === 0) {
            addLog({ file: '', status: 'error', message: 'No files selected to schedule.' });
            addNotification('No files selected to schedule.', 'error');
            return;
        }
        if (!activePage) {
            addLog({ file: '', status: 'error', message: 'No Facebook Page selected.' });
            addNotification('No Facebook Page selected.', 'error');
            return;
        }

        setIsScheduling(true);
        setIsPaused(false);
        schedulerCancelToken.current.cancelled = false;
        setSchedulingLog([]);
        setSchedulingProgress({ current: 0, total: schedulerSettings.files.length });
        
        let scheduleTimes: Date[] = [];

        try {
            if (schedulerSettings.smartScheduleEnabled) {
                addLog({ file: '', status: 'info', message: 'Using Smart Schedule. Generating optimal post times...' });
                scheduleTimes = await getSmartSchedule(activePage, schedulerSettings.files.length);
                addLog({ file: '', status: 'info', message: `Smart Schedule generated ${scheduleTimes.length} post times.` });
            } else {
                addLog({ file: '', status: 'info', message: `Using Manual Schedule for ${schedulerSettings.files.length} files...` });
                const [startH, startM] = schedulerSettings.startTime.split(':').map(Number);
                const [endH, endM] = schedulerSettings.endTime.split(':').map(Number);
                let scheduleTime = new Date(schedulerSettings.startDate);
                scheduleTime.setHours(startH, startM, 0, 0);

                for (let i = 0; i < schedulerSettings.files.length; i++) {
                    scheduleTimes.push(new Date(scheduleTime));
                    scheduleTime.setMinutes(scheduleTime.getMinutes() + schedulerSettings.interval);
                    if (scheduleTime.getHours() > endH || (scheduleTime.getHours() === endH && scheduleTime.getMinutes() > endM)) {
                        scheduleTime.setDate(scheduleTime.getDate() + 1);
                        scheduleTime.setHours(startH, startM, 0, 0);
                    }
                }
            }
        } catch (e: any) {
             addLog({ file: '', status: 'error', message: `Schedule generation failed: ${e.message}` });
             addNotification(`Could not generate schedule: ${e.message}`, 'error');
             setIsScheduling(false);
             return;
        }

        for (let i = 0; i < schedulerSettings.files.length; i++) {
            if (schedulerCancelToken.current.cancelled) {
                addLog({ file: '', status: 'info', message: 'Scheduling cancelled by user.' });
                addNotification('Scheduling process cancelled.', 'info');
                break;
            }

            while (isPausedRef.current) {
                if (schedulerCancelToken.current.cancelled) break;
                await sleep(1000);
            }

            const currentFile = schedulerSettings.files[i];
            setSchedulingProgress({ current: i + 1, total: schedulerSettings.files.length });
            
            let scheduleTime = scheduleTimes[i];
            
            if (scheduleTime.getTime() < Date.now() + 600000) { // must be at least 10min in the future
                const originalTime = new Date(scheduleTime);
                scheduleTime.setDate(scheduleTime.getDate() + 1); // try same time next day
                addLog({ file: currentFile.name, status: 'info', message: `Time ${originalTime.toLocaleString()} is in the past. Auto-adjusted to ${scheduleTime.toLocaleString()}` });
            }
            
            try {
                await uploadPost(currentFile, scheduleTime);
            } catch (e: any) {
                addLog({ file: currentFile.name, status: 'error', message: `Failed: ${e.message}` });
                 const message = (e.message || '').toLowerCase();
                 if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                    addNotification('Facebook token expired during operation. Please log in again.', 'error');
                    logout();
                    break;
                }
            }
        }

        addLog({ file: '', status: 'info', message: 'Scheduling complete.' });
        addNotification('Bulk scheduling process has finished.', 'success');
        setIsScheduling(false);
        setIsPaused(false);
    }, [schedulerSettings, activePage, addLog, isScheduling, uploadPost, addNotification, logout]);
    

    if (!isAuthenticated || !activePage) {
        return <FacebookLoginPrompt title="Connect to Facebook" subtitle="Enter your User Access Token to get started." />;
    }
    
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-6">
            <div className="p-4 bg-white dark:bg-gray-800/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50">
                <h1 className="text-2xl font-bold">Bulk Post Scheduler</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Currently scheduling for: <span className="font-semibold text-primary">{activePage.name}</span>
                </p>
            </div>
            
            <SchedulerTab
                schedulerSettings={schedulerSettings}
                handleSettingChange={handleSettingChange}
                handleFileSelect={handleFileSelect}
                isScheduling={isScheduling}
                isPaused={isPaused}
                isTesting={isTesting}
                handleTestUpload={handleTestUpload}
                handleSchedulingProcess={handleSchedulingProcess}
                setIsPaused={setIsPaused}
                schedulingProgress={schedulingProgress}
                schedulingLog={schedulingLog}
                logContainerRef={logContainerRef}
            />
            
        </div>
    );
};

export default UploaderPage;