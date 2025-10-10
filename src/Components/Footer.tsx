import type { CSSProperties, FunctionComponent } from 'react';

const Footer: FunctionComponent = () => {
  const styles: { [key: string]: CSSProperties } = {
    footer: {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 36px',
      boxSizing: 'border-box',
      fontSize: '19px',
      color: '#f04299',
      fontFamily: 'Pretendard',
      zIndex: 100,
      backgroundColor: '#f8f6f7', // 배경색 추가해서 내용이 겹치지 않도록
    },
    prev: {
      borderRadius: '12px',
      backgroundColor: '#ffe9f4',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 24px',
      boxSizing: 'border-box',
      cursor: 'pointer',
      fontSize: '16px',
    },
    labelWrapper: {
      display: 'flex',
      alignItems: 'flex-start',
    },
    label: {
      position: 'relative',
    },
    next: {
      borderRadius: '12px',
      backgroundColor: '#f04299',
      height: '32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '12px 24px',
      boxSizing: 'border-box',
      minWidth: '120px',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '16px',
    },
  };

  return (
    <footer style={styles.footer}>
      <div style={styles.prev}>
        <div style={styles.labelWrapper}>
          <div style={styles.label}>previous</div>
        </div>
      </div>
      <div style={styles.next}>
        <div style={styles.labelWrapper}>
          <div style={styles.label}>next</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
