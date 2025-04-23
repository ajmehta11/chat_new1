import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useTranscriber } from '../hooks/useTranscriber';

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

const ChatbotPage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'system',
            content: `You are a therapist. Speak like a real person in a conversation—empathetic, relaxed, and human. No bold text or bullet points. Keep your responses to 3–4 sentences. Imagine you're sitting across from someone in a calm space, just listening and gently responding.

Here is a sample exchange to guide your tone and style:
User: I have been feeling really isolated lately.
Bot: I am here to listen, Sarah. What’s been going on?
User: Ever since moving for grad school, I just... I spend most nights alone. Everyone seems to have their circles already. I scroll through social media and see people having these amazing times together, and I am just... here.
Bot: It’s a big transition. What do you miss most about your previous support system?
User: Just having someone to share the small things with, you know? Like when something funny happens during the day, or when I am struggling with a project... there is no one to just grab coffee with and talk.
Bot: That sounds really difficult. What small step do you think might help you feel more connected?

Keep it conversational and human—like you are talking with a friend who needs support.`
        },
    ]);

    
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [apiKey, setApiKey] = useState<string>('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [speechEnabled, setSpeechEnabled] = useState(true);

    const { isRecording, startRecording, stopRecording, audioData } = useAudioRecorder();
    const transcriber = useTranscriber();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const speechSynthesis = window.speechSynthesis;

    // Scroll to the bottom when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load API key from localStorage if available
    useEffect(() => {
        const savedApiKey = localStorage.getItem('openai_api_key');
        if (savedApiKey) {
            setApiKey(savedApiKey);
        }
    }, []);

    // Handle transcription when audioData is available
    useEffect(() => {
        if (audioData) {
            handleTranscription(audioData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [audioData]);

    // Stop speaking when component unmounts
    useEffect(() => {
        return () => {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
        };
    }, []);

    const speakText = (text: string) => {
        if (!speechEnabled) return;

        // Cancel any ongoing speech
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        // Get available voices and select one
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            // Try to find a female voice if available
            const femaleVoice = voices.find(voice => 
                voice.name.includes('female') || 
                voice.name.includes('Female') || 
                voice.name.includes('Google UK English Female')
            );
            utterance.voice = femaleVoice || voices[0];
        }

        speechSynthesis.speak(utterance);
    };

    const toggleSpeech = () => {
        setSpeechEnabled(prev => !prev);
        
        // Stop any ongoing speech if disabling
        if (speechEnabled && speechSynthesis.speaking) {
            speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    };

    const handleTranscription = async (audioBuffer: AudioBuffer) => {
        setIsLoading(true);
        try {
            // Use the start method from useTranscriber
            const result = await transcriber.start(audioBuffer);
            const transcribedText = result.text;
            setInputText(transcribedText);
            handleSend(transcribedText);
        } catch (error) {
            console.error('Transcription error:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Error: Unable to transcribe audio.',
            };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = async (messageText?: string) => {
        const text = messageText || inputText;
        if (!text.trim()) return;

        if (!apiKey) {
            alert('Please enter your OpenAI API key first.');
            return;
        }

        const newMessage: Message = { role: 'user', content: text };
        const updatedMessages = [...messages, newMessage];
        setMessages(updatedMessages);
        setInputText('');
        setIsLoading(true);
        
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: "gpt-4o-mini",
                    messages: updatedMessages,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                    },
                }
            );
            const assistantResponse = response.data.choices[0].message.content;
            const assistantMessage: Message = {
                role: 'assistant',
                content: assistantResponse,
            };
            setMessages((prevMessages) => [...prevMessages, assistantMessage]);
            
            // Speak the assistant's response
            speakText(assistantResponse);
        } catch (error) {
            console.error('Error communicating with OpenAI:', error);
            const errorMessage: Message = {
                role: 'assistant',
                content: 'Error: Unable to get a response from OpenAI API.',
            };
            setMessages((prevMessages) => [...prevMessages, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRecordButtonClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newApiKey = e.target.value;
        setApiKey(newApiKey);
        localStorage.setItem('openai_api_key', newApiKey);
    };

    return (
        <div className='flex flex-col h-screen'>
            {/* API Key Input */}
            <div className='p-4 bg-gray-100'>
                <input
                    type='password'
                    className='w-full border border-gray-300 rounded px-3 py-2'
                    value={apiKey}
                    onChange={handleApiKeyChange}
                    placeholder='Enter your OpenAI API key'
                />
            </div>
            
            {/* Chat Messages */}
            <div className='flex-1 overflow-auto p-4'>
                {messages.slice(1).map((msg, index) => (
                <div
                    key={index}
                    className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                    } mb-2`}
                >
                    <div
                    className={`rounded-lg p-2 max-w-xs md:max-w-md lg:max-w-lg ${
                        msg.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-black'
                    }`}
                    >
                    {msg.content}
                    {msg.role === 'assistant' && (
                        <button 
                            onClick={() => speakText(msg.content)}
                            className="ml-2 text-xs text-blue-600"
                            title="Read this message aloud"
                        >
                            🔊
                        </button>
                    )}
                    </div>
                </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className='p-4 bg-white flex items-center'>
                <input
                    type='text'
                    className='flex-1 border border-gray-300 rounded px-3 py-2 mr-2'
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={isLoading || isRecording || transcriber.isBusy}
                    placeholder={
                        transcriber.isModelLoading
                        ? 'Loading model...'
                        : transcriber.isBusy
                        ? 'Transcribing...'
                        : 'Type your message'
                    }
                />

                {/* Speech Toggle Button */}
                <button
                    onClick={toggleSpeech}
                    className={`p-2 rounded-full mr-2 ${
                        speechEnabled ? 'bg-green-500' : 'bg-gray-400'
                    } text-white`}
                    title={speechEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
                >
                    {speechEnabled ? '🔊' : '🔇'}
                </button>

                {/* Record Button */}
                <button
                    onClick={handleRecordButtonClick}
                    disabled={isLoading || transcriber.isModelLoading || transcriber.isBusy}
                    className={`mr-2 p-2 rounded-full text-white ${
                        isRecording ? 'bg-red-500' : 'bg-green-500'
                    } ${(isLoading || transcriber.isModelLoading || transcriber.isBusy) ? 'opacity-50' : ''}`}
                >
                    {isRecording ? 'End' : 'Record'}
                </button>

                <button
                    onClick={() => handleSend()}
                    disabled={
                        isLoading || !inputText.trim() || isRecording || transcriber.isBusy
                    }
                    className='px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50'
                >
                    Send
                </button>
            </div>

            {/* Speaking Indicator */}
            {isSpeaking && (
                <div className="fixed bottom-20 right-4 bg-blue-500 text-white px-3 py-1 rounded-full animate-pulse">
                    Speaking...
                </div>
            )}
        </div>
    );
};

export default ChatbotPage;