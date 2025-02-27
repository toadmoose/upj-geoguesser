// File: src/App.jsx
import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

const locationImage1 = 'images/location1.jpg';

// Create custom icons for actual location and guess
const actualLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const guessLocationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Fix default Leaflet marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// campus locations with images
const campusLocations = [
  {
    id: 1,
    image: locationImage1,
    position: [40.2661444, -78.8320306], 
    name: 'Bench Area'
  },
];

// Sample leaderboard data - in a real app, this would be stored in a database
const initialLeaderboard = [
  { name: "Emma Johnson", email: "ej123@pitt.edu", score: 4850 },
  { name: "James Smith", email: "js456@pitt.edu", score: 4720 },
  { name: "Olivia Brown", email: "ob789@pitt.edu", score: 4500 },
  { name: "William Davis", email: "wd101@pitt.edu", score: 4350 },
  { name: "Sophia Miller", email: "sm202@pitt.edu", score: 4200 }
];

// Campus center coordinates and boundaries
const campusCenter = [40.266522, -78.833958]; 
const campusBounds = [
  [40.263739, -78.828781], // Southwest corner
  [40.269451, -78.837729]  // Northeast corner
];

// Constants
const ROUND_TIME_LIMIT = 60; // 1 minute in seconds

function App() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [userGuess, setUserGuess] = useState(null);
  const [score, setScore] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [round, setRound] = useState(0);
  const [gameState, setGameState] = useState('login'); // 'login', 'start', 'guessing', 'result', 'end'
  const [distance, setDistance] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [leaderboard, setLeaderboard] = useState(initialLeaderboard);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [usedEmails, setUsedEmails] = useState([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME_LIMIT);
  const [timerActive, setTimerActive] = useState(false);
  const timerRef = useRef(null);
  
  // Load leaderboard and used emails from localStorage on component mount
  useEffect(() => {
    const savedLeaderboard = localStorage.getItem('upjGeoguesserLeaderboard');
    if (savedLeaderboard) {
      setLeaderboard(JSON.parse(savedLeaderboard));
    }
    
    const savedUsedEmails = localStorage.getItem('upjGeoguesserUsedEmails');
    if (savedUsedEmails) {
      setUsedEmails(JSON.parse(savedUsedEmails));
    } else {
      // Initialize with emails from the leaderboard
      const initialEmails = initialLeaderboard.map(player => player.email);
      setUsedEmails(initialEmails);
      localStorage.setItem('upjGeoguesserUsedEmails', JSON.stringify(initialEmails));
    }
  }, []);

  // Timer effect
  useEffect(() => {
    if (timerActive && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
    } else if (timerActive && timeLeft === 0) {
      // Time's up - submit current guess or skip round
      handleTimeUp();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [timerActive, timeLeft]);

  // Handle time up
  const handleTimeUp = () => {
    setTimerActive(false);
    
    if (userGuess) {
      // Submit whatever guess the user has made
      submitGuess();
    } else {
      // No guess made, score zero for this round
      setScore(0);
      setDistance(null);
      setGameState('result');
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Validate Pitt email
  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@pitt\.edu$/;
    return emailRegex.test(email);
  };

  // Check if email has been used
  const checkEmailUniqueness = (email) => {
    return !usedEmails.includes(email.toLowerCase());
  };

  // Handle login submission
  const handleLogin = (e) => {
    e.preventDefault();
    
    if (!validateEmail(playerEmail)) {
      setEmailError('Please enter a valid Pitt email address (ending with @pitt.edu)');
      return;
    }
    
    if (!checkEmailUniqueness(playerEmail)) {
      setEmailError('This email has already been used. Each student can only play once.');
      return;
    }
    
    setEmailError('');
    setGameState('start');
  };

  // Reset timer for a new round
  const resetTimer = () => {
    setTimeLeft(ROUND_TIME_LIMIT);
    setTimerActive(true);
  };

  // Load a random location
  const loadRandomLocation = () => {
    const randomIndex = Math.floor(Math.random() * campusLocations.length);
    setCurrentLocation(campusLocations[randomIndex]);
    setUserGuess(null);
    setDistance(null);
    setGameState('guessing');
    resetTimer(); // Start the timer for the new round
  };

  // Start a new game
  const startGame = () => {
    setRound(1);
    setTotalScore(0);
    loadRandomLocation();
  };

  // Start next round
  const nextRound = () => {
    if (round >= 5) {
      setGameState('end');
      setTimerActive(false); // Stop the timer when game ends
    } else {
      setRound(round + 1);
      loadRandomLocation();
    }
  };

  // Calculate score based on distance
  const calculateScore = (distanceInMeters) => {
    // Simple scoring: max 1000 points, lose points based on distance
    const maxScore = 1000;
    const pointsLostPerMeter = 5;
    const calculatedScore = Math.max(0, maxScore - (distanceInMeters * pointsLostPerMeter));
    return Math.round(calculatedScore);
  };

  // Calculate distance between two points
  const calculateDistance = (point1, point2) => {
    const lat1 = point1[0];
    const lon1 = point1[1];
    const lat2 = point2[0];
    const lon2 = point2[1];
    
    // Haversine formula
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // in meters
    
    return distance;
  };

  // Submit guess
  const submitGuess = () => {
    setTimerActive(false); // Stop the timer
    
    if (!currentLocation) return;
    
    let roundScore = 0;
    let distanceInMeters = null;
    
    if (userGuess) {
      distanceInMeters = calculateDistance(userGuess, currentLocation.position);
      roundScore = calculateScore(distanceInMeters);
    }
    
    setDistance(distanceInMeters);
    setScore(roundScore);
    setTotalScore(prevTotal => prevTotal + roundScore);
    setGameState('result');
  };

  // Update leaderboard and mark email as used
  const updateLeaderboard = () => {
    // Create new player entry
    const playerEntry = {
      name: playerName,
      email: playerEmail.toLowerCase(),
      score: totalScore
    };
    
    // Add player to leaderboard and sort
    const updatedLeaderboard = [...leaderboard, playerEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Keep only top 5
    
    // Add email to used emails list if it's not already there
    if (!usedEmails.includes(playerEmail.toLowerCase())) {
      const updatedUsedEmails = [...usedEmails, playerEmail.toLowerCase()];
      setUsedEmails(updatedUsedEmails);
      localStorage.setItem('upjGeoguesserUsedEmails', JSON.stringify(updatedUsedEmails));
    }
    
    // Save updated leaderboard
    setLeaderboard(updatedLeaderboard);
    localStorage.setItem('upjGeoguesserLeaderboard', JSON.stringify(updatedLeaderboard));
    
    setShowLeaderboard(true);
  };

  // Reset game
  const playAgain = () => {
    logout(); // Return to login since email can only be used once
  };

  // Log out
  const logout = () => {
    setPlayerName('');
    setPlayerEmail('');
    setGameState('login');
    setShowLeaderboard(false);
    setTimerActive(false);
  };

  // For admin/testing: Reset all used emails
  const resetUsedEmails = () => {
    const initialEmails = initialLeaderboard.map(player => player.email);
    setUsedEmails(initialEmails);
    localStorage.setItem('upjGeoguesserUsedEmails', JSON.stringify(initialEmails));
    alert('All used emails have been reset except for the leaderboard entries.');
  };

  // Map click handler component
  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        if (gameState === 'guessing') {
          setUserGuess([e.latlng.lat, e.latlng.lng]);
        }
      },
    });
    return null;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>UPJ GeoGuesser</h1>
        {gameState !== 'login' && gameState !== 'start' && (
          <div className="game-info">
            <span>Player: {playerName}</span>
            <span>Round: {round}/5</span>
            <span>Total Score: {totalScore}</span>
            {timerActive && (
              <span className={`timer ${timeLeft <= 10 ? 'timer-warning' : ''}`}>
                Time: {formatTime(timeLeft)}
              </span>
            )}
          </div>
        )}
      </header>

      <main className="main">
        {gameState === 'login' && (
          <div className="login-with-leaderboard">
            <div className="login-section">
              <h2>Login to UPJ GeoGuesser</h2>
              <p>Please enter your name and Pitt email to continue.</p>
              
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="playerName">Your Name:</label>
                  <input 
                    type="text" 
                    id="playerName" 
                    value={playerName} 
                    onChange={(e) => setPlayerName(e.target.value)}
                    required
                    placeholder="Enter your name"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="playerEmail">Pitt Email:</label>
                  <input 
                    type="email" 
                    id="playerEmail" 
                    value={playerEmail} 
                    onChange={(e) => setPlayerEmail(e.target.value)}
                    required
                    placeholder="youremail@pitt.edu"
                  />
                  {emailError && <div className="error-message">{emailError}</div>}
                  <div className="email-note">
                    Note: Each Pitt email can only be used once to play.
                  </div>
                </div>
                
                <button type="submit" className="primary-button">Login</button>
                
                {/* Hidden button for admin use - double click to reset emails */}
                <button 
                  type="button" 
                  className="admin-reset-button" 
                  onDoubleClick={resetUsedEmails}
                  aria-hidden="true"
                ></button>
              </form>
            </div>
            
            <div className="leaderboard-section">
              <div className="leaderboard">
                <h3>Top Players</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Name</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, index) => (
                      <tr key={index}>
                        <td>{index + 1}</td>
                        <td>{player.name}</td>
                        <td>{player.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {gameState === 'start' && (
          <div className="start-screen">
            <h2>Welcome to UPJ GeoGuesser, {playerName}!</h2>
            <p>Test how well you know your campus. Look at the image and guess where it was taken.</p>
            <div className="button-group">
              <button className="primary-button" onClick={startGame}>Start Game</button>
              <button className="secondary-button" onClick={logout}>Logout</button>
            </div>
          </div>
        )}

        {gameState === 'guessing' && currentLocation && (
          <div className="game-screen">
            <div className="image-container">
              <img 
                src={currentLocation.image} 
                alt="Campus location" 
                onError={(e) => {
                  console.error("Image failed to load:", currentLocation.image);
                  e.target.style.backgroundColor = "#eee";
                  e.target.style.padding = "20px";
                  e.target.alt = "Error loading image";
                }}
              />
              <div className="timer-overlay">
                <div className={`timer-display ${timeLeft <= 10 ? 'timer-warning' : ''}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>
            <div className="map-container">
              <div className="map-rotation-wrapper">
                <MapContainer 
                  center={campusCenter} 
                  zoom={17} 
                  style={{ height: '100%', width: '100%' }}
                  maxBounds={campusBounds}
                  minZoom={16}
                  maxZoom={19}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {userGuess && <Marker position={userGuess} icon={guessLocationIcon}>
                    <Popup>Your guess</Popup>
                  </Marker>}
                  <MapClickHandler />
                </MapContainer>
              </div>
            </div>
            <button 
              className="primary-button" 
              onClick={submitGuess} 
              disabled={!userGuess}
            >
              Submit Guess
            </button>
          </div>
        )}

        {gameState === 'result' && currentLocation && (
          <div className="result-screen">
            <h2>Round Result</h2>
            <div className="result-details">
              <p>The location was: {currentLocation.name}</p>
              {distance !== null ? (
                <p>Your guess was {distance.toFixed(2)} meters away</p>
              ) : (
                <p>You didn't make a guess in time</p>
              )}
              <p>You scored {score} points this round!</p>
            </div>
            <div className="result-map-container">
              <div className="map-rotation-wrapper">
                <MapContainer 
                  center={campusCenter} 
                  zoom={17} 
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={currentLocation.position} icon={actualLocationIcon}>
                    <Popup>Actual location: {currentLocation.name}</Popup>
                  </Marker>
                  {userGuess && <Marker position={userGuess} icon={guessLocationIcon}>
                    <Popup>Your guess</Popup>
                  </Marker>}
                  {userGuess && (
                    <Polyline 
                      positions={[userGuess, currentLocation.position]} 
                      color="blue" 
                      weight={3}
                      opacity={0.7}
                      dashArray="10, 10"
                    />
                  )}
                </MapContainer>
              </div>
            </div>
            <button className="primary-button" onClick={nextRound}>
              {round >= 5 ? 'See Final Results' : 'Next Round'}
            </button>
          </div>
        )}

        {gameState === 'end' && (
          <div className="end-screen">
            <h2>Game Over!</h2>
            <p>Congratulations, {playerName}!</p>
            <p>Your final score: {totalScore} / 5000</p>
            
            {!showLeaderboard ? (
              <div className="button-group">
                <button className="primary-button" onClick={updateLeaderboard}>
                  Save Score & View Leaderboard
                </button>
                <button className="secondary-button" onClick={logout}>Logout</button>
              </div>
            ) : (
              <div className="leaderboard">
                <h3>Top Players</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Name</th>
                      <th>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, index) => (
                      <tr key={index} className={player.email === playerEmail.toLowerCase() && player.score === totalScore ? 'current-player' : ''}>
                        <td>{index + 1}</td>
                        <td>{player.name}</td>
                        <td>{player.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="button-group">
                  <button className="primary-button" onClick={logout}>
                    Finish
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;