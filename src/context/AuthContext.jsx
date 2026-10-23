import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session in localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email, password, allowedRoles = null) => {
    const loggedInUser = await authService.login(email, password);
    
    if (allowedRoles && !allowedRoles.includes(loggedInUser.role)) {
      if (allowedRoles.includes('admin')) throw new Error("Unauthorized access. Admin privileges required.");
      if (allowedRoles.includes('teacher')) throw new Error("Unauthorized access. Teacher privileges required.");
      throw new Error("Guest login required.");
    }
    
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
    return loggedInUser;
  };

  const register = async (userData) => {
    const newUser = await authService.register(userData);
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
    return newUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const updateUserProfile = async (updates) => {
    if (!user?.id) throw new Error("No active user session");
    const updatedUser = await authService.updateProfile(user.id, updates);
    const mergedUser = { ...user, ...updatedUser };
    setUser(mergedUser);
    localStorage.setItem('user', JSON.stringify(mergedUser));
    
    // Notify app-wide components (navbar, sidebar, profile)
    window.dispatchEvent(new Event('indicatorsChanged'));
    return mergedUser;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isLoading, 
      login, 
      register, 
      logout, 
      updateUserProfile, 
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
