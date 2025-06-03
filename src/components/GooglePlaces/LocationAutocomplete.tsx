import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme';

interface LocationInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onClear: () => void;
  onSelectLocation?: (location: string) => void;
}

interface PlaceSuggestion {
  description: string;
  place_id: string;
}

const LocationAutocomplete: React.FC<LocationInputProps> = ({
  value,
  onChangeText,
  placeholder,
  onClear,
  onSelectLocation
}) => {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [value]);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsLoading(true);
    try {
      // Always use mock data for now to ensure it works
      // We'll enable the actual API call once everything else works
      console.log('Fetching suggestions for:', input);
      
      // Mock data for testing
      const mockSuggestions = [
        { place_id: '1', description: 'New York, NY, USA' },
        { place_id: '2', description: 'London, UK' },
        { place_id: '3', description: 'Paris, France' },
        { place_id: '4', description: 'Tokyo, Japan' },
        { place_id: '5', description: 'Sydney, Australia' },
        { place_id: '6', description: 'Dubai, UAE' },
        { place_id: '7', description: 'Toronto, Canada' },
        { place_id: '8', description: 'Berlin, Germany' },
        { place_id: '9', description: 'Lagos, Nigeria' },
        { place_id: '10', description: 'Mumbai, India' },
        { place_id: '11', description: 'Mexico City, Mexico' },
        { place_id: '12', description: 'Rio de Janeiro, Brazil' },
        { place_id: '13', description: 'Cape Town, South Africa' },
        { place_id: '14', description: 'Rome, Italy' },
        { place_id: '15', description: 'Hong Kong' }
      ];
      
      const filteredSuggestions = mockSuggestions.filter(s => 
        s.description.toLowerCase().includes(input.toLowerCase())
      );
      
      console.log('Found suggestions:', filteredSuggestions.length);
      setSuggestions(filteredSuggestions);
      setShowSuggestions(true);

      // Uncomment this section when ready to use the actual API
      /*
      const endpoint = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        input
      )}&key=${GOOGLE_PLACES_API_KEY}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();
      
      if (data.status === 'OK' && data.predictions) {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      } else {
        console.warn('Google Places API error:', data.status);
        setSuggestions(mockSuggestions.filter(s => 
          s.description.toLowerCase().includes(input.toLowerCase())
        ));
        setShowSuggestions(true);
      }
      */
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      // If there's any error, still show mock data
      const mockSuggestions = [
        { place_id: '1', description: 'New York, NY, USA' },
        { place_id: '2', description: 'London, UK' },
        { place_id: '3', description: 'Paris, France' },
        { place_id: '4', description: 'Tokyo, Japan' },
        { place_id: '5', description: 'Sydney, Australia' },
        { place_id: '6', description: 'Dubai, UAE' }
      ];
      const filteredSuggestions = mockSuggestions.filter(s => 
        s.description.toLowerCase().includes(input.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
      setShowSuggestions(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSuggestion = (suggestion: PlaceSuggestion) => {
    onChangeText(suggestion.description);
    if (onSelectLocation) {
      onSelectLocation(suggestion.description);
    }
    setSuggestions([]);
    setShowSuggestions(false);
    Keyboard.dismiss();
  };

  console.log('Rendering LocationAutocomplete', { value, showSuggestions, suggestionsCount: suggestions.length });

  return (
    <View style={[styles.container, { marginBottom: showSuggestions && suggestions.length > 0 ? 200 : 0 }]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (text.length > 1) {
              fetchSuggestions(text);
            } else {
              setShowSuggestions(false);
            }
          }}
          placeholderTextColor={colors.text.secondary}
          onFocus={() => value && value.length > 1 && setShowSuggestions(true)}
        />
        {isLoading ? (
          <ActivityIndicator 
            style={styles.loadingIndicator} 
            size="small" 
            color={colors.primary} 
          />
        ) : value ? (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => {
              onClear();
              setSuggestions([]);
              setShowSuggestions(false);
            }}
          >
            <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        ) : null}
      </View>
      
      {showSuggestions && suggestions.length > 0 && (() => {
        console.log('Rendering suggestions list', suggestions.length);
        return (
          <View style={styles.suggestionsContainer}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              style={styles.suggestionsScrollView}
            >
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectSuggestion(item)}
                >
                  <Ionicons name="location-outline" size={16} color={colors.primary} style={styles.locationIcon} />
                  <Text style={styles.suggestionText} numberOfLines={2}>{item.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        );
      })()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    zIndex: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    height: 50,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#000',
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    overflow: 'visible',
  },
  suggestionItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  loadingIndicator: {
    padding: 8,
  },
  locationIcon: {
    marginRight: 10,
  },
  suggestionsScrollView: {
    // Add any additional styles for the ScrollView if needed
  },
});

export default LocationAutocomplete; 