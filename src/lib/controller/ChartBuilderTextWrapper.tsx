// React Dependencies
import { Fragment } from 'react';
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

	return (
		<Fragment>
			{active && (
				<div className={`cb__text-wrapper`} style={{ maxWidth: `${width}px`, width: '100%' }}>
					{horizontalRules && <HorizontalRule position={'top'} maxWidth={width} />}
					{title && <Title title={title} />}
					{subtitle && <Subtitle subtitle={subtitle} />}
					{children}
					{note && <SourceNote note={note} />}
					{source && <SourceNote note={source} />}
					{tag && <Tag tag={tag} />}
					{horizontalRules && <HorizontalRule position={'bottom'} maxWidth={width} />}
				</div>
			)}
			{!active && children}
		</Fragment>
	);
};

export default ChartBuilderTextWrapper;
