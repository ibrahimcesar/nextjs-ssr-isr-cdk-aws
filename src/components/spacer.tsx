interface Spacer {
  size: string
  axis?: 'vertical' | 'horizontal'
  delegated?: {}
  style?: {}
}

const Spacer = (props: Spacer) => {
  const width = props.axis === 'vertical' ? 1 : props.size;
  const height = props.axis === 'horizontal' ? 1 : props.size;
  return (
    <span
      style={{
        display: 'block',
        width,
        minWidth: width,
        height,
        minHeight: height,
        ...props.style,
      }}
      {...props.delegated}
    />
  );
};

export default Spacer;