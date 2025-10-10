import type { CSSProperties, FunctionComponent } from 'react';

const Header: FunctionComponent = () => {
  const styles: { [key: string]: CSSProperties } = {
    header: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '74px',
      backgroundColor: '#f8f6f7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 36px',
      boxSizing: 'border-box',
      fontSize: '32px',
      color: '#1e1e1e',
      fontFamily: 'Pretendard',
      zIndex: 100,
    },
    sayjong: {
      fontWeight: 600,
    },
    navigation: {
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      fontSize: '20px',
      color: '#313131',
    },
    home: {
      position: 'relative',
    },
    lesson: {
      position: 'relative',
      color: '#f04299',
    },
    history: {
      position: 'relative',
      color: '#1e1e1e',
    },
    accountCircleIcon: {
      width: '50px',
      height: '50px',
      objectFit: 'contain',
    },
  };

  return (
    <header style={styles.header}>
      <div style={styles.sayjong}>SayJong</div>

      <nav style={styles.navigation}>
        <div style={styles.home}>Home</div>
        <div style={styles.lesson}>Lesson</div>
        <div style={styles.history}>History</div>
      </nav>

      <img
        style={styles.accountCircleIcon}
        alt="Account Icon"
        src="src\assets\account_circle.svg"  // 이 경로는 실제 아이콘 경로로 바꾸세요
      />
    </header>
  );
};

export default Header;
