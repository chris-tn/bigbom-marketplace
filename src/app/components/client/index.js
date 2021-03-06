import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Link, Route, Switch } from 'react-router-dom';
import { connect } from 'react-redux';

import YourJobs from './YourJobs';
import JobDetail from '../../components/client/JobDetail';
import PostJob from '../../components/client//PostJob';
import NotFound from '../../components/NotFound';
import UserInfoNav from '../../components/common/UserInfoNav';
import Parameters from '../Parameters';

import { setView } from '../../actions/commonActions';

const styles = theme => ({
    lightTooltip: {
        background: theme.palette.common.white,
        color: '#555',
        boxShadow: theme.shadows[1],
        fontSize: 15,
        maxWidth: 'inherit',
    },
});

class ClientCatagories extends Component {
    componentDidMount() {
        const { isConnected, history, setView } = this.props;
        setView('client');
        if (!isConnected) {
            history.push('/');
        }
    }

    render() {
        const { match } = this.props;
        const listSubLink = [
            {
                title: 'Post a Job',
                path: `${match.url}`,
                exact: true,
                component: PostJob,
            },
            {
                title: 'Your Jobs',
                path: `${match.url}/your-jobs`,
                component: YourJobs,
            },
            {
                title: 'Parameters',
                path: `${match.url}/parameters`,
                component: Parameters,
            },
        ];

        return (
            <div id="main" className="container-wrp">
                <div className="container-wrp main-nav">
                    <div className="container">
                        <ul>
                            {listSubLink.map((route, key) => (
                                <Route key={key} path={route.path} exact={route.exact}>
                                    {({ match }) => (
                                        <li className={match ? 'actived' : null}>
                                            <Link to={route.path}>{route.title}</Link>
                                        </li>
                                    )}
                                </Route>
                            ))}
                        </ul>
                        <UserInfoNav />
                    </div>
                </div>
                <Switch>
                    <Route path={`${match.url}/your-jobs/:jobId`} render={props => <JobDetail {...props} />} />
                    {listSubLink.length && listSubLink.map((route, key) => <Route key={key} {...route} />)}
                    <Route component={NotFound} />
                </Switch>
            </div>
        );
    }
}

ClientCatagories.propTypes = {
    history: PropTypes.object.isRequired,
    isConnected: PropTypes.bool.isRequired,
    match: PropTypes.object.isRequired,
    classes: PropTypes.object.isRequired,
    setView: PropTypes.func.isRequired,
};

const mapStateToProps = state => {
    return {
        isConnected: state.HomeReducer.isConnected,
    };
};

const mapDispatchToProps = { setView };

export default withStyles(styles)(
    connect(
        mapStateToProps,
        mapDispatchToProps
    )(ClientCatagories)
);
