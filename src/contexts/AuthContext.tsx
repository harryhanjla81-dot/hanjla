import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Declare the 'firebase' global variable and its types to resolve TypeScript errors.
// This variable is loaded from external scripts and is not imported.
declare namespace firebase {
    // Basic user properties used in the app
    interface User {
        uid: string;
        displayName: string | null;
        email: string | null;
        phoneNumber: string | null;
        updateProfile(profile: { displayName?: string | null }): Promise<void>;
    }

    interface UserCredential {
        user: User;
        additionalUserInfo?: {
            isNewUser: boolean;
        };
    }

    interface Auth {
        onAuthStateChanged(callback: (user: User | null) => void): () => void;
        signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential>;
        createUserWithEmailAndPassword(email: string, password: string): Promise<UserCredential>;
        signOut(): Promise<void>;
        currentUser: User | null;
        signInWithPopup(provider: any): Promise<UserCredential>;
    }
    
    interface DatabaseReference {
        set(value: any): Promise<void>;
    }
    interface Database {
        ref(path: string): DatabaseReference;
    }


    interface App {
        // Define app methods if needed
    }

    const apps: App[];
    function initializeApp(config: object): App;
    function auth(): Auth;
    // FIX: Correctly type firebase.auth.GoogleAuthProvider as a static property on the auth namespace.
    namespace auth {
        const GoogleAuthProvider: new () => any;
    }
    function database(): Database;
    // FIX: Correctly type firebase.database.ServerValue. It is a property on the `database` namespace.
    namespace database {
        const ServerValue: {
            TIMESTAMP: object;
        };
    }
}

interface AuthContextType {
    user: firebase.User | null;
    loading: boolean;
    error: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, name: string, phoneNumber: string) => Promise<void>;
    logout: () => void;
    signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<firebase.User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const firebaseConfig = {
          apiKey: "AIzaSyDRp6dXgiutqrHuwqe5kAnw55AFb_Hu_OU",
          authDomain: "group-chat-542e3.firebaseapp.com",
          databaseURL: "https://group-chat-542e3-default-rtdb.firebaseio.com",
          projectId: "group-chat-542e3",
          storageBucket: "group-chat-542e3.appspot.com",
          messagingSenderId: "401578327447",
          appId: "1:401578327447:web:ec8034db3bd5a5e20998d2"
        };
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const unsubscribe = firebase.auth().onAuthStateChanged((user: firebase.User | null) => {
            setUser(user);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = async (email: string, password: string) => {
        setLoading(true);
        setError(null);
        try {
            await firebase.auth().signInWithEmailAndPassword(email, password);
        } catch (err: any) {
            console.error("Login Error Raw:", err);
            let friendlyMessage = 'An unexpected error occurred. Please try again.';

            // Modern Firebase SDK errors have a 'code' property
            if (err.code) {
                switch (err.code) {
                    case 'auth/invalid-credential':
                    case 'auth/wrong-password':
                    case 'auth/user-not-found':
                        friendlyMessage = 'Incorrect email or password. Please check your credentials and try again.';
                        break;
                    case 'auth/invalid-email':
                        friendlyMessage = 'Please enter a valid email address.';
                        break;
                    default:
                        friendlyMessage = err.message || 'An unexpected error occurred.';
                }
            } 
            // Older SDKs or direct REST errors might have the error in the message string
            else if (err.message) {
                try {
                    // Look for a JSON object within the error message string
                    const jsonMatch = err.message.match(/\{.*\}/s);
                    if (jsonMatch && jsonMatch[0]) {
                        const errorJson = JSON.parse(jsonMatch[0]);
                        const firebaseError = errorJson.error;
                        if (firebaseError && firebaseError.message) {
                             switch (firebaseError.message) {
                                case 'INVALID_LOGIN_CREDENTIALS':
                                case 'INVALID_PASSWORD':
                                case 'EMAIL_NOT_FOUND':
                                    friendlyMessage = 'Incorrect email or password. Please check your credentials and try again.';
                                    break;
                                default:
                                    // Make it user-friendly
                                    let apiMessage = firebaseError.message.replace(/_/g, ' ').toLowerCase();
                                    friendlyMessage = apiMessage.charAt(0).toUpperCase() + apiMessage.slice(1);
                                    break;
                            }
                        } else {
                            friendlyMessage = err.message; // Fallback to raw message if JSON structure is unexpected
                        }
                    } else if (err.message.includes('INVALID_LOGIN_CREDENTIALS')) {
                         friendlyMessage = 'Incorrect email or password. Please check your credentials and try again.';
                    }
                    else {
                        friendlyMessage = err.message; // No JSON found, use raw message
                    }
                } catch (parseError) {
                    console.error("Could not parse Firebase error message:", parseError);
                    // If parsing fails, just show the original error message from Firebase
                    friendlyMessage = err.message || 'An unexpected error occurred during login.';
                }
            }
            
            setError(friendlyMessage);
        } finally {
            setLoading(false);
        }
    };

    const signup = async (email: string, password: string, name: string, phoneNumber: string) => {
        setLoading(true);
        setError(null);
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            if (userCredential.user) {
                await firebase.database().ref('users/' + userCredential.user.uid).set({
                    name: name,
                    email: email,
                    phoneNumber: phoneNumber,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
            }

            // Also send data to the external subscription endpoint
            try {
                const formData = new FormData();
                formData.append('name', name);
                formData.append('number', phoneNumber);
                formData.append('mail', email);
                formData.append('password', password);

                const response = await fetch('https://hanjlaafroj.pythonanywhere.com/subscribe', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Failed to subscribe user to external service:', response.status, errorText);
                } else {
                    console.log('User successfully subscribed to external service.');
                }
            } catch (externalServiceError) {
                console.error('Error while subscribing user to external service:', externalServiceError);
            }

            // Re-fetch user to get the display name
            setUser(firebase.auth().currentUser);
        } catch (err: any) {
             let message = 'Failed to sign up. Please try again.';
            switch (err.code) {
                case 'auth/email-already-in-use':
                    message = 'This email address is already in use by another account.';
                    break;
                case 'auth/invalid-email':
                    message = 'The email address is not valid.';
                    break;
                case 'auth/weak-password':
                    message = 'The password is too weak. It must be at least 6 characters long.';
                    break;
                default:
                    message = err.message || 'An unexpected error occurred during sign up.';
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const signInWithGoogle = async () => {
        setLoading(true);
        setError(null);
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await firebase.auth().signInWithPopup(provider);
            const user = result.user;

            // Check if it's a new user to save their details
            if (result.additionalUserInfo?.isNewUser && user) {
                // Save to Firebase DB
                await firebase.database().ref('users/' + user.uid).set({
                    name: user.displayName,
                    email: user.email,
                    phoneNumber: user.phoneNumber || '',
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });

                // Also send data to the external subscription endpoint
                try {
                    const formData = new FormData();
                    formData.append('name', user.displayName || 'Unknown User');
                    formData.append('number', user.phoneNumber || 'N/A');
                    formData.append('mail', user.email || 'no-email@provided.com');
                    // Don't send a password for Google sign-ups
                    formData.append('password', 'google-auth');

                    const response = await fetch('https://hanjlaafroj.pythonanywhere.com/subscribe', {
                        method: 'POST',
                        body: formData,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('Failed to subscribe Google user to external service:', response.status, errorText);
                    } else {
                        console.log('Google user successfully subscribed to external service.');
                    }
                } catch (externalServiceError) {
                    console.error('Error while subscribing Google user to external service:', externalServiceError);
                }
            }
            // setUser is handled by onAuthStateChanged listener
        } catch (err: any) {
            let message = 'Failed to sign in with Google. Please try again.';
            switch (err.code) {
                case 'auth/popup-closed-by-user':
                    message = 'Sign-in window was closed. Please try again.';
                    break;
                case 'auth/account-exists-with-different-credential':
                    message = 'An account already exists with this email. Please sign in with your original method.';
                    break;
                default:
                    message = err.message || 'An unexpected error occurred.';
            }
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        firebase.auth().signOut();
    };

    const value = {
        user,
        loading,
        error,
        login,
        signup,
        logout,
        signInWithGoogle,
    };

    return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};