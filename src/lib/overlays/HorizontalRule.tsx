type Rule = {
  position: 'top' | 'bottom';
  maxWidth: number;
};

const HorizontalRule = (props: Rule) => {
  const { position, maxWidth } = props;
  return (
    <hr
      style={{
        margin: position === 'top' ? '0 0 10px 0' : '10px 0 0 0',
        maxWidth: `${maxWidth}px`,
      }}
    />
  );
};

export default HorizontalRule;
