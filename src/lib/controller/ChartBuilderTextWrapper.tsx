// Internal Dependencies
import { Title, Subtitle, HorizontalRule, SourceNote, Tag } from '../overlays';

type TextWrapperProps = {
	active: boolean;
	width: number;
	children: any;
	horizontalRules?: boolean;
	title?: string;
	subtitle?: string;
	note?: string;
	source?: string;
	tag?: string;
};

const ChartBuilderTextWrapper = (props: TextWrapperProps) => {
	const { children, horizontalRules, width, title, subtitle, note, source, tag, active } = props;

	// Attribute width is a cap, not a floor, so the text tracks the chart when a
	// narrower container shrinks it. Matches the frontend markup in class-chart.php.
	const wrapperStyle = {
		width: '100%',
		maxWidth: `${width}px`,
		marginLeft: 'auto',
		marginRight: 'auto',
	};

	return (
		<div className="cb__text-wrapper" style={wrapperStyle}>
			{active && horizontalRules && <HorizontalRule position={'top'} maxWidth={width} />}
			{active && title && <Title title={title} />}
			{active && subtitle && <Subtitle subtitle={subtitle} />}
			{children}
			{active && note && <SourceNote note={note} />}
			{active && source && <SourceNote note={source} />}
			{active && tag && <Tag tag={tag} />}
			{active && horizontalRules && <HorizontalRule position={'bottom'} maxWidth={width} />}
		</div>
	);
};

export default ChartBuilderTextWrapper;
