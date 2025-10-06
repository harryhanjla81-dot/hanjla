
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Spinner from './Spinner.tsx';
import { useNotification } from '../src/contexts/NotificationContext.tsx';
import { FBPage, Conversation, Message } from '../types.ts';
import * as geminiService from '../services/geminiService.ts';
import { GenerateIcon, ChatBubbleBottomCenterTextIcon, Cog6ToothIcon } from './IconComponents.tsx';

const API_VERSION = 'v19.0';
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface MessagesContentProps {
    activePage: FBPage;
    onAuthError: () => void;
}

const MessagesContent: React.FC<MessagesContentProps> = ({ activePage, onAuthError }) => {
    const { addNotification } = useNotification();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [conversationsError, setConversationsError] = useState<string | null>(null);
    
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    
    const [replyText, setReplyText] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [isGeneratingAiReply, setIsGeneratingAiReply] = useState(false);
    
    const [customCta, setCustomCta] = useState<string>('');
    const [sendFollowUp, setSendFollowUp] = useState<boolean>(false);
    const [useHumanAgentTag, setUseHumanAgentTag] = useState<boolean>(false);
    const [isBulkReplying, setIsBulkReplying] = useState<boolean>(false);
    const [bulkReplyProgress, setBulkReplyProgress] = useState({ current: 0, total: 0 });
    const [isReplySettingsOpen, setIsReplySettingsOpen] = useState(false);

    const processConversations = useCallback((rawConvos: any[], pageId: string): Conversation[] => {
        return rawConvos.map(convo => {
            const customer = convo.participants.data.find((p: any) => p.id !== pageId);
            const lastMessage = convo.messages?.data[0];
            let isWithin24HourWindow; 
            
            // This is a heuristic for the list view. A more accurate check happens when a convo is selected.
            // It checks the last message from ANYONE.
            if (lastMessage && lastMessage.from.id !== pageId) {
                const messageTime = new Date(lastMessage.created_time).getTime();
                const now = new Date().getTime();
                isWithin24HourWindow = (now - messageTime) < (24 * 60 * 60 * 1000); 
            } else {
                // If the last message was from the page, or there are no messages, the window is closed.
                isWithin24HourWindow = false;
            }

            return { 
                ...convo, 
                customerName: customer ? customer.name : 'Unknown User',
                isWithin24HourWindow
            };
        });
    }, []);

    const fetchConversations = useCallback(async (page: FBPage) => {
        setIsLoadingConversations(true);
        setConversationsError(null);
        setConversations([]);
        setSelectedConversationId(null);
        setMessages([]);
        try {
            const fields = "id,participants,unread_count,messages.limit(1){message,from,created_time}";
            const url = `https://graph.facebook.com/${API_VERSION}/${page.id}/conversations?fields=${fields}&limit=50&access_token=${page.access_token}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            
            const processedConvos = processConversations(data.data || [], page.id);
            setConversations(processedConvos);
            
        } catch (e: any) {
            const message = (e.message || '').toLowerCase();
            if (message.includes('session') || message.includes('token') || message.includes('oauth')) {
                onAuthError();
            } else if (message.includes('permission')) {
                setConversationsError("Permission Denied: Ensure your access token has 'pages_messaging' permission.");
            } else {
                setConversationsError(`Failed to fetch conversations: ${e.message}`);
            }
        } finally {
            setIsLoadingConversations(false);
        }
    }, [onAuthError, processConversations]);

    const selectConversation = useCallback(async (convoId: string) => {
        if (selectedConversationId === convoId) return;
        setSelectedConversationId(convoId);
        setIsLoadingMessages(true);
        setMessages([]);
        try {
            const fields = "messages.limit(100){id,created_time,from,message,attachments{image_data}}";
            const url = `https://graph.facebook.com/${API_VERSION}/${convoId}?fields=${fields}&access_token=${activePage.access_token}`;
            const response = await fetch(url);
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const fetchedMessages: Message[] = (data.messages?.data || []);
            setMessages(fetchedMessages.slice().reverse());

            const lastUserMessage = [...fetchedMessages].reverse().find(m => m.from.id !== activePage.id);
            let isWindowOpen = false;
            if (lastUserMessage) {
                const messageTime = new Date(lastUserMessage.created_time).getTime();
                const now = new Date().getTime();
                if ((now - messageTime) < (24 * 60 * 60 * 1000)) {
                    isWindowOpen = true;
                }
            }
            
            setConversations(prev => prev.map(c => 
                c.id === convoId ? { ...c, isWithin24HourWindow: isWindowOpen, unread_count: 0 } : c
            ));

        } catch (e: any) {
            addNotification(`Error fetching messages: ${e.message}`, 'error');
        } finally {
            setIsLoadingMessages(false);
        }
    }, [activePage.id, activePage.access_token, addNotification, selectedConversationId]);

    useEffect(() => { if (activePage) fetchConversations(activePage); }, [activePage, fetchConversations]);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }); }, [messages]);

    const sendReplyAndFollowUp = useCallback(async (text: string, conversation: Conversation, isBulk: boolean = false) => {
        const recipient = conversation.participants.data.find(p => p.id !== activePage.id);
        if (!recipient) throw new Error(`Could not identify recipient for conversation with ${conversation.customerName}.`);

        if (!isBulk) setIsSendingReply(true);

        const isOutsideWindow = !conversation.isWithin24HourWindow;
        const canUseTag = isOutsideWindow && useHumanAgentTag;
        
        const optimisticMessage: Message = { id: `optimistic-${Date.now()}`, created_time: new Date().toISOString(), from: { name: activePage.name, id: activePage.id }, message: text, isOptimistic: true };
        if (conversation.id === selectedConversationId && !isBulk) setMessages(prev => [...prev, optimisticMessage]);

        try {
            const messageBody = { text: `${text}${customCta ? `\n\n${customCta}` : ''}`.trim() };
            const replyRequestBody = {
                recipient: { id: recipient.id },
                message: messageBody,
                messaging_type: canUseTag ? 'MESSAGE_TAG' : 'RESPONSE',
                ...(canUseTag && { tag: 'HUMAN_AGENT' }),
                access_token: activePage.access_token,
            };

            const replyResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${activePage.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(replyRequestBody) });
            const replyData = await replyResponse.json();
            if (replyData.error) throw new Error(`(#${replyData.error.code}) ${replyData.error.message}`);
            
            if (conversation.id === selectedConversationId && !isBulk) setMessages(prev => prev.map(msg => msg.id === optimisticMessage.id ? { ...optimisticMessage, id: replyData.message_id, isOptimistic: false } : msg));

            if (sendFollowUp && !canUseTag) {
                await sleep(1500);
                const history = (conversation.messages?.data || messages).map(m => ({ from: m.from.id === activePage.id ? 'Page' : 'User', message: m.message }));
                history.push({ from: 'Page', message: text });
                const followUpQuestions = await geminiService.generateFollowUpQuestions(history);
                const followUpRequestBody = { recipient: { id: recipient.id }, message: { text: followUpQuestions }, messaging_type: 'RESPONSE', access_token: activePage.access_token };
                const followUpResponse = await fetch(`https://graph.facebook.com/${API_VERSION}/${activePage.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(followUpRequestBody) });
                const followUpData = await followUpResponse.json();
                if(followUpData.error) throw new Error(`Follow-up failed: ${followUpData.error.message}`);
            }
        } catch (e: any) {
            if (conversation.id === selectedConversationId && !isBulk) setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
            throw e;
        } finally {
            if (!isBulk) setIsSendingReply(false);
        }
    }, [activePage, customCta, sendFollowUp, messages, selectedConversationId, useHumanAgentTag]);

    const handleSendManualClick = async () => {
        const conversation = conversations.find(c => c.id === selectedConversationId);
        if (!replyText.trim() || !conversation) return;
        try {
            await sendReplyAndFollowUp(replyText, conversation);
            setReplyText('');
        } catch (e: any) {
            if (e.message && e.message.includes('Cannot tag messages with "HUMAN_AGENT" without prior approval')) {
                addNotification("Permission Error: Your Facebook App needs the 'Human Agent' permission to send messages outside the 24-hour window. Please apply for it in your App settings.", 'error');
            } else {
                addNotification(`Failed to send reply: ${e.message}`, 'error');
            }
        }
    };
    
    const handleAiReplyClick = async () => {
        const conversation = conversations.find(c => c.id === selectedConversationId);
        if (!conversation || messages.length === 0) return addNotification('Cannot generate a reply for an empty or unselected conversation.', 'info');
        setIsGeneratingAiReply(true);
        try {
            const history = messages.slice(-5).map(m => ({ from: m.from.id === activePage.id ? 'Page' : 'User', message: m.message }));
            const lastUserMsgWithAttachment = [...messages].reverse().find(m => m.from.id !== activePage.id && m.attachments?.data?.[0]?.image_data?.url);
            const imageUrl = lastUserMsgWithAttachment?.attachments?.data[0].image_data?.url || null;
            const aiResponse = await geminiService.generateMessageReply(history, activePage.name, imageUrl, '');
            setReplyText(aiResponse);
        } catch (e: any) {
            addNotification(`AI reply generation failed: ${e.message}`, 'error');
        } finally {
            setIsGeneratingAiReply(false);
        }
    };

    const handleBulkReplyAll = async () => {
        const conversationsToReply = conversations.filter(c => c.unread_count > 0 && (c.isWithin24HourWindow || useHumanAgentTag));
        if (conversationsToReply.length === 0) {
            const message = useHumanAgentTag
                ? 'No unread conversations found.'
                : 'No unread conversations within the 24-hour reply window.';
            return addNotification(message, 'info');
        }

        if (useHumanAgentTag && conversationsToReply.some(c => !c.isWithin24HourWindow)) {
            if (!window.confirm("You are about to bulk reply to conversations outside the 24-hour window using the 'Human Agent' tag. This is an advanced feature. Are you sure you want to proceed?")) {
                return;
            }
        }
    
        setIsBulkReplying(true);
        setBulkReplyProgress({ current: 0, total: conversationsToReply.length });
        addNotification(`Starting bulk reply to ${conversationsToReply.length} conversations.`, 'info');
    
        for (const [index, convo] of conversationsToReply.entries()) {
            setBulkReplyProgress({ current: index + 1, total: conversationsToReply.length });
            try {
                const fields = "messages.limit(100){id,from,message,attachments{image_data}}";
                const url = `https://graph.facebook.com/${API_VERSION}/${convo.id}?fields=${fields}&access_token=${activePage.access_token}`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.error) throw new Error(data.error.message);
    
                const convoMessages: Message[] = (data.messages?.data || []);
                if (convoMessages.length === 0) continue;
    
                const history = convoMessages.slice(0, 5).reverse().map(m => ({ from: m.from.id === activePage.id ? 'Page' : 'User', message: m.message }));
                const lastUserMsgWithAttachment = [...convoMessages].reverse().find(m => m.from.id !== activePage.id && m.attachments?.data?.[0]?.image_data?.url);
                const imageUrl = lastUserMsgWithAttachment?.attachments?.data[0].image_data?.url || null;
    
                const aiResponse = await geminiService.generateMessageReply(history, activePage.name, imageUrl, '');
                await sendReplyAndFollowUp(aiResponse, convo, true);
                await sleep(5000); 
    
            } catch (e: any) {
                if (e.message && e.message.includes('Cannot tag messages with "HUMAN_AGENT" without prior approval')) {
                    addNotification("Permission Error: Your Facebook App needs the 'Human Agent' permission. Stopping bulk reply.", 'error');
                    break;
                } else {
                    addNotification(`Failed to reply to ${convo.customerName}: ${e.message}`, 'error');
                }
            }
        }
        
        setIsBulkReplying(false);
        addNotification('Bulk reply process finished.', 'info');
        await fetchConversations(activePage);
    };

    const selectedConversation = conversations.find(c => c.id === selectedConversationId);
    const isReplyDisabled = isBulkReplying || (selectedConversation && !selectedConversation.isWithin24HourWindow && !useHumanAgentTag);


    return (
        <div className="flex h-[calc(100vh-15rem)] bg-white dark:bg-gray-800/50 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700/50 overflow-hidden">
            <div className="w-full md:w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="font-bold text-lg">Conversations</h2>
                    <button onClick={handleBulkReplyAll} disabled={isBulkReplying || conversations.filter(c=>c.unread_count > 0 && (c.isWithin24HourWindow || useHumanAgentTag)).length === 0} className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-lg shadow-md hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                        {isBulkReplying ? <Spinner size="sm" /> : <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />}
                        <span>Reply All Unread</span>
                    </button>
                </div>
                {isBulkReplying && (
                    <div className="p-2 text-center border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
                        <p className="text-xs text-gray-500">{bulkReplyProgress.current} / {bulkReplyProgress.total}</p>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${bulkReplyProgress.total > 0 ? (bulkReplyProgress.current / bulkReplyProgress.total) * 100 : 0}%` }}></div></div>
                    </div>
                )}
                <div className={`flex-grow overflow-y-auto scrollbar-thin ${isBulkReplying ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isLoadingConversations ? <div className="flex flex-col justify-center items-center h-full gap-2"><Spinner /></div>
                    : conversationsError ? <div className="p-4 text-center text-red-500">{conversationsError}</div>
                    : conversations.length === 0 ? <div className="p-4 text-center text-gray-500">No conversations found.</div>
                    : <ul>{conversations.map(convo => <li key={convo.id}><button onClick={() => selectConversation(convo.id)} disabled={isBulkReplying} className={`w-full text-left p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all relative ${selectedConversationId === convo.id ? 'bg-primary/10 dark:bg-primary/20' : ''} ${!convo.isWithin24HourWindow ? 'opacity-60' : ''}`}><div className={`absolute left-0 top-0 bottom-0 w-1 ${selectedConversationId === convo.id ? 'bg-primary' : 'bg-transparent'}`}></div><div className="flex justify-between items-center"><p className="font-semibold truncate">{convo.customerName}</p>{convo.unread_count > 0 && <span className="bg-primary text-primary-text text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">{convo.unread_count}</span>}</div><div className="flex justify-between items-end"><p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1 flex-grow pr-2">{convo.messages?.data[0]?.message || 'No messages yet.'}</p><p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{convo.messages?.data[0]?.created_time ? new Date(convo.messages.data[0].created_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</p></div></button></li>)}</ul>}
                </div>
            </div>
            <div className="w-full md:w-2/3 flex flex-col bg-gray-50 dark:bg-gray-800">
                {!selectedConversationId ? <div className="flex-grow flex items-center justify-center text-gray-500"><p>Select a conversation to view messages</p></div>
                : <>
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80"><h3 className="font-bold text-lg">{selectedConversation?.customerName || 'Conversation'}</h3></div>
                    <div className="flex-grow p-4 space-y-4 overflow-y-auto scrollbar-thin">{isLoadingMessages ? <div className="flex justify-center items-center h-full"><Spinner /></div> : messages.map(msg => <div key={msg.id} className={`flex items-end gap-2 ${msg.from.id === activePage.id ? 'justify-end' : 'justify-start'}`}><div className={`max-w-xs lg:max-w-xl px-4 py-2 rounded-2xl shadow ${msg.from.id === activePage.id ? 'bg-primary text-primary-text rounded-br-none' : 'bg-white dark:bg-gray-700 rounded-bl-none'} ${msg.isOptimistic ? 'opacity-70' : ''}`}><p className="text-sm break-words whitespace-pre-wrap">{msg.message}</p><p className="text-xs opacity-70 mt-1 text-right">{new Date(msg.created_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div></div>)}<div ref={messagesEndRef} /></div>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 space-y-3">
                        {selectedConversation && !selectedConversation.isWithin24HourWindow && !useHumanAgentTag && (
                            <div className="p-3 text-center bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-700 rounded-lg">
                                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">24-Hour Window Closed</p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">Enable 'Human Agent' tag in settings to send one follow-up.</p>
                            </div>
                        )}
                        {selectedConversation && !selectedConversation.isWithin24HourWindow && useHumanAgentTag && (
                            <div className="p-2 text-center text-xs bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
                                <p className="text-blue-800 dark:text-blue-200">
                                    You are sending a message outside the 24-hour window using the <strong>Human Agent</strong> tag.
                                </p>
                            </div>
                        )}
                        <div className={`transition-all duration-300 ease-in-out ${isReplySettingsOpen ? 'max-h-60 opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                            <div className="p-3 bg-gray-100 dark:bg-gray-900/50 rounded-lg border dark:border-gray-700 space-y-3 mb-3">
                                <input type="text" value={customCta} onChange={e => setCustomCta(e.target.value)} placeholder="Enter a custom CTA..." className="w-full text-sm p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600"/>
                                <label className="flex items-center justify-between cursor-pointer"><span className="text-sm">Generate Follow-up Questions</span><div className="relative"><input type="checkbox" checked={sendFollowUp} onChange={e => setSendFollowUp(e.target.checked)} className="sr-only peer" /><div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div></div></label>
                                <label className="flex items-center justify-between cursor-pointer pt-3 border-t dark:border-gray-700">
                                    <div>
                                        <span className="text-sm font-medium">Use 'Human Agent' Tag</span>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Bypasses 24-hour window for one follow-up message (within 7 days).</p>
                                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Requires 'Human Agent' permission from Facebook.</p>
                                    </div>
                                    <div className="relative flex-shrink-0 ml-4">
                                        <input type="checkbox" checked={useHumanAgentTag} onChange={e => setUseHumanAgentTag(e.target.checked)} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        <div className="flex items-start gap-2">
                            <button onClick={() => setIsReplySettingsOpen(p => !p)} title="Reply Settings" className="p-2 text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light transition-colors"><Cog6ToothIcon className="w-5 h-5"/></button>
                            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Type your reply..." rows={2} className="w-full p-2 border rounded-md bg-white dark:bg-gray-700 dark:border-gray-600" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendManualClick(); } }} disabled={isReplyDisabled}/>
                            <div className="flex flex-col gap-2">
                                <button onClick={handleSendManualClick} disabled={isSendingReply || !replyText.trim() || isReplyDisabled} className="px-4 py-2 bg-primary text-primary-text font-semibold rounded-md hover:bg-primary-hover disabled:opacity-50"> {isSendingReply ? <Spinner size="sm" /> : 'Send'}</button>
                                <button onClick={handleAiReplyClick} disabled={isGeneratingAiReply || isSendingReply || isReplyDisabled} className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-md hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1.5">{isGeneratingAiReply ? <Spinner size="sm" /> : <GenerateIcon className="w-4 h-4" />}<span className="hidden sm:inline">AI Reply</span></button>
                            </div>
                        </div>
                    </div>
                </>}
            </div>
        </div>
    );
};

export default MessagesContent;
