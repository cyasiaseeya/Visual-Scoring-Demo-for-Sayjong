import { type FunctionComponent } from 'react';
import styles from './Calibration.module.css';
import CameraComponent from './Components/CameraComponent';
import Header from './Components/Header';
import Footer from './Components/Footer';
import MicIcon from './assets/mic.svg';

interface CalibrationProps {
  modeButtons?: React.ReactNode;
}

const Calibration: FunctionComponent<CalibrationProps> = ({ modeButtons }) => {
  return (
    <div className={styles.calibration}>
      <Header />
      
      <div className={styles.title}>
        <div className={styles.watchTheCamera}>Watch the camera</div>
        <div className={styles.pleasePronouceThese}>Please pronouce these vowels</div>
      </div>
      
      <div className={styles.container}>
        <div className={styles.rectangleParent}>
          <CameraComponent />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <img className={styles.micIcon} src={MicIcon} alt="Microphone" />
            {modeButtons}
          </div>
        </div>
        <div className={styles.frameParent}>
          <div className={styles.landmarksContainer}>
            <h3 className={styles.landmarksTitle}>Face Landmarks & Blendshapes</h3>
            <div className={styles.landmarksDisplay} id="landmarks-display">
              {/* Landmarks and blendshapes will be displayed here */}
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Calibration;
