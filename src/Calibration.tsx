import { type FunctionComponent } from 'react';
import styles from './Calibration.module.css';
import CameraComponent from './Components/CameraComponent';
import Header from './Components/Header';
import Footer from './Components/Footer';
import MicIcon from './assets/mic.svg';

const Calibration: FunctionComponent = () => {
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
          <img className={styles.micIcon} src={MicIcon} alt="Microphone" />
        </div>
        <div className={styles.frameParent}>
          <div className={styles.wordParent}>
            <div className={styles.word}>
              <img className={styles.frameIcon} alt="" />
              <div className={styles.div}>아</div>
              <img className={styles.frameIcon} alt="" />
            </div>
            <div className={styles.brandAwarenessParent}>
              <img className={styles.brandAwarenessIcon} alt="" />
              <div className={styles.home}>[a:]</div>
            </div>
          </div>
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Calibration;
